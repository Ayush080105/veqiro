-- Expense Tracker: safe migration (expense tables only, no drops)
-- Run this in the Supabase SQL editor

-- Enums
CREATE TYPE "ExpenseCategory" AS ENUM ('FOOD', 'TRAVEL', 'ACCOMMODATION', 'OFFICE', 'ENTERTAINMENT', 'UTILITIES', 'SUBSCRIPTIONS', 'EQUIPMENT', 'OTHER');
CREATE TYPE "SplitType" AS ENUM ('EQUAL', 'EXACT', 'PERCENTAGE');

-- Tables
CREATE TABLE "expense_group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "expense_group_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expense_group_member" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expense_group_member_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expense" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "paidByMemberId" TEXT NOT NULL,
    "receiptUrl" TEXT,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "cronExpression" TEXT,
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "expense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expense_split" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "splitType" "SplitType" NOT NULL,
    "shareAmount" DOUBLE PRECISION NOT NULL,
    "shareAmountUsd" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "expense_split_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "settlement" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "fromMemberId" TEXT NOT NULL,
    "toMemberId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "method" TEXT,
    "notes" TEXT,
    "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "settlement_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "expense_group_createdAt_idx" ON "expense_group"("createdAt");
CREATE INDEX "expense_group_member_groupId_idx" ON "expense_group_member"("groupId");
CREATE UNIQUE INDEX "expense_group_member_groupId_name_key" ON "expense_group_member"("groupId", "name");
CREATE INDEX "expense_groupId_date_idx" ON "expense"("groupId", "date");
CREATE INDEX "expense_groupId_category_idx" ON "expense"("groupId", "category");
CREATE INDEX "expense_paidByMemberId_idx" ON "expense"("paidByMemberId");
CREATE INDEX "expense_isRecurring_nextRunAt_idx" ON "expense"("isRecurring", "nextRunAt");
CREATE INDEX "expense_split_expenseId_idx" ON "expense_split"("expenseId");
CREATE INDEX "expense_split_memberId_idx" ON "expense_split"("memberId");
CREATE UNIQUE INDEX "expense_split_expenseId_memberId_key" ON "expense_split"("expenseId", "memberId");
CREATE INDEX "settlement_groupId_settledAt_idx" ON "settlement"("groupId", "settledAt");
CREATE INDEX "settlement_fromMemberId_idx" ON "settlement"("fromMemberId");
CREATE INDEX "settlement_toMemberId_idx" ON "settlement"("toMemberId");

-- Foreign keys
ALTER TABLE "expense_group_member" ADD CONSTRAINT "expense_group_member_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "expense_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense" ADD CONSTRAINT "expense_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "expense_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense" ADD CONSTRAINT "expense_paidByMemberId_fkey" FOREIGN KEY ("paidByMemberId") REFERENCES "expense_group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expense_split" ADD CONSTRAINT "expense_split_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense_split" ADD CONSTRAINT "expense_split_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "expense_group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "expense_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_fromMemberId_fkey" FOREIGN KEY ("fromMemberId") REFERENCES "expense_group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_toMemberId_fkey" FOREIGN KEY ("toMemberId") REFERENCES "expense_group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
