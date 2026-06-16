import { aiService } from "../../../common/utils/aiService.js";
import {
  getGoogleAccessToken,
  GoogleNotConnectedError,
} from "../../../common/utils/googleAuth.js";
import {
  labelMessage,
  createGmailDraft,
} from "../../../common/utils/googleApis.js";
import { prisma } from "../../../config/prisma.js";
import {
  getLabelDefinitions,
  getLabels,
  mapPriorityToCategory,
} from "./vega.workspace.service.js";
import type { ProcessInboxResponse, NodeAction } from "./vega.types.js";

export async function runEmailPipeline(
  userId: string,
  organizationId: string
): Promise<void> {
  // 1. Get Google access token — skip org silently if not connected
  let token: string;
  try {
    token = await getGoogleAccessToken(userId);
  } catch (err) {
    if (err instanceof GoogleNotConnectedError) return;
    throw err;
  }

  // 2. Get org's labels (seeds defaults on first run) for dynamic label list and autoReply flags
  const orgLabels = await getLabels(organizationId);
  const customLabelNames = orgLabels.map((l) => l.name);
  const labelDefinitions = getLabelDefinitions(orgLabels);
  const labelColors = new Map(orgLabels.map((l) => [l.name, l.color]));
  const normalizeLabel = (label: string) => {
    const found = orgLabels.find((l) => l.name.toLowerCase() === label.toLowerCase());
    if (found) return found.name;
    return orgLabels.find((l) => l.name.toLowerCase() === "other")?.name ?? customLabelNames[0] ?? "Other";
  };
  const autoReplyLabelNames = new Set(
    orgLabels.filter((l) => l.autoReply).map((l) => l.name)
  );

  // 3. Process inbox via AI
  const { data } = await aiService.post<ProcessInboxResponse>(
    "/ai/vega/process-inbox",
    {
      user_id: userId,
      organization_id: organizationId,
      max_emails: 20,
      auto_label: true,
      draft_replies: false,
      skip_labeled: true,
      custom_labels: customLabelNames,
      label_definitions: labelDefinitions,
      metadata: { google_access_token: token },
    }
  );

  const processed = data.processed ?? [];

  // 4. Execute label_messages node_actions — apply labels in Gmail
  const labelAction = (data.node_actions ?? []).find(
    (a) => (a as { node_action: string }).node_action === "label_messages"
  ) as { node_action: string; messages: Array<{ email_id: string; label: string }> } | undefined;

  if (labelAction?.messages?.length) {
    await Promise.allSettled(
      labelAction.messages.map(({ email_id, label }) => {
        const labelName = normalizeLabel(label);
        return labelMessage({
          accessToken: token,
          messageId: email_id,
          labelName,
          managedLabelNames: customLabelNames,
          labelColor: labelColors.get(labelName),
        }).catch((err: unknown) =>
          console.error(`[email-job] Label failed for ${email_id}:`, err)
        );
      })
    );
  }

  // 5. Auto-draft replies for emails whose label has autoReply=true
  const autoReplyEmails = processed.filter(
    (e) => e.label_applied && autoReplyLabelNames.has(e.label_applied)
  );

  if (autoReplyEmails.length > 0) {
    await Promise.allSettled(
      autoReplyEmails.map(async (e) => {
        try {
          const { data: draftData } = await aiService.post<{
            draft: { to: string; subject: string; body: string };
            node_actions: NodeAction[];
          }>("/ai/vega/draft-reply", {
            user_id: userId,
            organization_id: organizationId,
            email_id: e.email_id,
            reply_instructions:
              "Draft a professional contextual reply based on the email content",
            tone: "professional",
            save_as_draft: true,
            metadata: { google_access_token: token },
          });

          const draftAction = (draftData.node_actions ?? []).find(
            (a) => a.node_action === "create_gmail_draft"
          ) as
            | {
                node_action: string;
                to: string;
                subject: string;
                body: string;
                reply_to_message_id?: string | null;
                reply_to_thread_id?: string | null;
              }
            | undefined;

          if (draftAction) {
            await createGmailDraft({
              accessToken: token,
              to: draftAction.to,
              subject: draftAction.subject,
              body: draftAction.body,
              replyToMessageId: draftAction.reply_to_message_id ?? null,
              replyToThreadId: draftAction.reply_to_thread_id ?? null,
            });
          }
        } catch (err) {
          console.error(
            `[email-job] Auto-draft failed for email ${e.email_id}:`,
            err
          );
        }
      })
    );
  }

  // 6. Update inbox cache with fresh results
  const snapshot = {
    emails: processed.map((e) => ({
      emailId: e.email_id,
      subject: e.subject,
      fromName: e.from_name,
      fromEmail: e.from_email ?? "",
      priority: e.priority,
      uiCategory: mapPriorityToCategory(e.priority, e.suggested_action),
      label: e.label_applied ?? "Other",
      summary: e.summary,
      suggestedAction: e.suggested_action,
      hiddenTasks: e.hidden_tasks ?? [],
      suggestedReply: e.suggested_reply ?? null,
      meetingRequest: e.meeting_request ?? null,
      isVIP: false,
      receivedAt: null,
      threadId: null,
    })),
    stats: data.stats,
  };

  await prisma.vegaInboxSnapshot.upsert({
    where: { organizationId },
    update: { snapshot: snapshot as object, cachedAt: new Date() },
    create: { organizationId, snapshot: snapshot as object },
  });

  console.log(
    `[email-job] Processed ${processed.length} emails for org ${organizationId} (${autoReplyEmails.length} auto-drafted)`
  );
}
