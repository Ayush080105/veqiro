"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { createOrgSchema, type CreateOrgValues } from "@/lib/schemas/org"

type CreateOrgFormValues = CreateOrgValues

export function CreateOrgDialog() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const form = useForm<CreateOrgFormValues>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      name: "",
      members: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "members",
  })

  const onSubmit = async (data: CreateOrgFormValues) => {
    try {
      setLoading(true)

      const { data: org, error: orgError } = await authClient.organization.create({
        name: data.name,
        slug: data.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        onboarded: false,
      })

      if (orgError || !org) {
        toast.error(orgError?.message ?? "Failed to create organization")
        return
      }

      const members = data.members ?? []
      if (members.length > 0) {
        await Promise.allSettled(
          members.map((member) =>
            authClient.organization.inviteMember({
              email: member.email,
              role: member.role,
              organizationId: org.id,
            })
          )
        )
      }

      toast.success("Organization created successfully")
      router.push("/dashboard")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={true}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Create your organization
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Set up your workspace to get started with your AI team.
          </p>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <FieldGroup>
            {/* Organization name */}
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="org-name">Organization name</FieldLabel>
                  <Input
                    {...field}
                    id="org-name"
                    placeholder="Acme Inc."
                    disabled={loading}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>

          {/* Members section */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-foreground">
                Invite members
                <span className="ml-1 text-muted-foreground font-normal">(optional)</span>
              </p>
            </div>

            {fields.length > 0 && (
              <div className="flex flex-col gap-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-2">
                    <Controller
                      name={`members.${index}.email`}
                      control={form.control}
                      render={({ field: emailField, fieldState }) => (
                        <Field data-invalid={fieldState.invalid} className="flex-1">
                          <Input
                            {...emailField}
                            placeholder="colleague@example.com"
                            type="email"
                            disabled={loading}
                            aria-invalid={fieldState.invalid}
                          />
                          {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                          )}
                        </Field>
                      )}
                    />

                    <Controller
                      name={`members.${index}.role`}
                      control={form.control}
                      render={({ field: roleField }) => (
                        <Select
                          value={roleField.value}
                          onValueChange={roleField.onChange}
                          disabled={loading}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue placeholder="Role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(index)}
                      disabled={loading}
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                      <span className="sr-only">Remove member</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => append({ email: "", role: "member" })}
              disabled={loading}
              className="w-fit text-muted-foreground"
            >
              <Plus className="size-3.5" />
              Add another member
            </Button>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Creating…
              </>
            ) : (
              "Create Organization"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
