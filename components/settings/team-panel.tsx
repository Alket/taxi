"use client"

import * as React from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  BanIcon,
  CircleCheckIcon,
  CopyIcon,
  KeyRoundIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

import { ADMIN_ROLE_LABELS } from "@/lib/auth-client"
import { apiDelete, apiPatch, apiPost, fetcher } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import type { AdminRole, AdminUser } from "@/lib/types"
import { useAdminSession } from "@/hooks/use-admin-session"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field } from "@/components/settings/shared"

export function TeamPanel() {
  const { data, isLoading, mutate } = useSWR<{ users: AdminUser[] }>(
    "/api/admin/team",
    fetcher,
  )
  const users = data?.users ?? []
  const { user: currentUser, canDelete: isAdmin } = useAdminSession()
  const colSpan = isAdmin ? 5 : 4

  return (
    <Card className="min-w-0 gap-0 py-0">
      <CardHeader className="flex-col items-stretch gap-3 border-b py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-sm">Team</CardTitle>
          <CardDescription className="text-xs">
            Admins and operators with access to this console
          </CardDescription>
        </div>
        <InviteAdminDialog
          canInviteAdmins={isAdmin}
          onInvited={() => mutate()}
        />
      </CardHeader>
      {/* Mobile */}
      <div className="divide-y md:hidden">
        {isLoading ? (
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No team members yet.
          </p>
        ) : (
          users.map((u) => (
            <TeamMemberCard
              key={u.id}
              member={u}
              isAdmin={isAdmin}
              isSelf={currentUser?.id === u.id}
              onChanged={() => mutate()}
            />
          ))
        )}
      </div>
      {/* Desktop */}
      <div className="hidden overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last login</TableHead>
              {isAdmin && (
                <TableHead className="pr-4 text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={colSpan} className="pl-4">
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className="pl-4 py-8 text-center text-sm text-muted-foreground"
                >
                  No team members yet.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TeamMemberRow
                  key={u.id}
                  member={u}
                  isAdmin={isAdmin}
                  isSelf={currentUser?.id === u.id}
                  onChanged={() => mutate()}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}

function ResetPasswordControl({
  member,
  onChanged,
  variant = "button",
}: {
  member: AdminUser
  onChanged: () => void
  variant?: "button" | "icon"
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [resultOpen, setResultOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [result, setResult] = React.useState<{
    temporaryPassword: string
    emailSent?: boolean
    emailError?: string
  } | null>(null)

  if (member.role !== "operator") return null

  async function resetPassword() {
    setPending(true)
    try {
      const res = await apiPost<{
        temporaryPassword: string
        emailSent?: boolean
        emailError?: string
      }>(`/api/admin/team/${member.id}/reset-password`)
      setResult(res)
      setConfirmOpen(false)
      setResultOpen(true)
      toast.success(
        res.emailSent
          ? `Password reset email sent to ${member.email}.`
          : `Password reset for ${member.email}.`,
      )
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function copyPassword() {
    if (!result?.temporaryPassword) return
    try {
      await navigator.clipboard.writeText(result.temporaryPassword)
      toast.success("Temporary password copied.")
    } catch {
      toast.error("Failed to copy password.")
    }
  }

  return (
    <>
      {variant === "icon" ? (
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => setConfirmOpen(true)}
          disabled={member.suspended}
          aria-label={`Reset password for ${member.email}`}
          title="Reset password"
        >
          <KeyRoundIcon />
        </Button>
      ) : (
        <Button
          variant="outline"
          className="h-10 flex-1 touch-manipulation"
          onClick={() => setConfirmOpen(true)}
          disabled={member.suspended}
        >
          <KeyRoundIcon data-icon="inline-start" />
          Reset password
        </Button>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset operator password?</AlertDialogTitle>
            <AlertDialogDescription>
              This generates a temporary password for{" "}
              <span className="font-medium text-foreground">{member.email}</span>{" "}
              and requires them to set a new password on next login.
              {member.suspended
                ? " Reactivate the account first."
                : " We will email them if SMTP is configured."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending || member.suspended}
              onClick={(e) => {
                e.preventDefault()
                void resetPassword()
              }}
            >
              {pending ? "Resetting…" : "Reset password"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={resultOpen}
        onOpenChange={(open) => {
          setResultOpen(open)
          if (!open) setResult(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {result?.emailSent ? "Reset email sent" : "Share temporary password"}
            </DialogTitle>
            <DialogDescription>
              {result?.emailSent
                ? `We emailed login details to ${member.email}. You can still copy the password below as a backup.`
                : `Could not send email${result?.emailError ? ` (${result.emailError})` : ""}. Copy the temporary password and share it with ${member.email} manually.`}
            </DialogDescription>
          </DialogHeader>
          <Field
            label="Temporary password"
            hint="They must sign in and set a new password."
          >
            <div className="flex gap-2">
              <Input
                readOnly
                value={result?.temporaryPassword ?? ""}
                className="font-mono"
                aria-label="Temporary password"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void copyPassword()}
                aria-label="Copy temporary password"
              >
                <CopyIcon />
              </Button>
            </div>
          </Field>
          <DialogFooter>
            <Button
              onClick={() => {
                setResultOpen(false)
                setResult(null)
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function TeamMemberCard({
  member,
  isAdmin,
  isSelf,
  onChanged,
}: {
  member: AdminUser
  isAdmin: boolean
  isSelf: boolean
  onChanged: () => void
}) {
  const [suspendPending, setSuspendPending] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deletePending, setDeletePending] = React.useState(false)

  async function toggleSuspend() {
    setSuspendPending(true)
    try {
      await apiPatch(`/api/admin/team/${member.id}`, {
        suspended: !member.suspended,
      })
      toast.success(
        member.suspended
          ? `${member.email} reactivated.`
          : `${member.email} suspended.`,
      )
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSuspendPending(false)
    }
  }

  async function confirmDelete() {
    setDeletePending(true)
    try {
      await apiDelete(`/api/admin/team/${member.id}`)
      toast.success(`${member.email} removed from the team.`)
      setDeleteOpen(false)
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{member.name}</p>
          {member.suspended ? (
            <Badge variant="secondary" className="text-amber-600">
              Suspended
            </Badge>
          ) : null}
          {member.requiresPasswordReset ? (
            <span className="text-xs text-muted-foreground">
              (pending setup — must set password on first login)
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {member.email}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {ADMIN_ROLE_LABELS[member.role]}
          {" · "}
          {member.lastLoginAt
            ? `Last login ${formatDateTime(member.lastLoginAt)}`
            : "Never logged in"}
        </p>
      </div>

      {isAdmin ? (
        isSelf ? (
          <p className="text-xs text-muted-foreground">This is you</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <ResetPasswordControl member={member} onChanged={onChanged} />
            <Button
              variant="outline"
              className="h-10 flex-1 touch-manipulation"
              onClick={() => void toggleSuspend()}
              disabled={suspendPending}
            >
              {member.suspended ? (
                <CircleCheckIcon data-icon="inline-start" />
              ) : (
                <BanIcon data-icon="inline-start" />
              )}
              {member.suspended ? "Reactivate" : "Suspend"}
            </Button>
            <Button
              variant="outline"
              className="h-10 touch-manipulation text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
              aria-label={`Delete ${member.email}`}
            >
              <Trash2Icon />
            </Button>
          </div>
        )
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete{" "}
              <span className="font-medium text-foreground">
                {member.email}
              </span>
              . They will lose access to the console immediately. Suspend
              instead if you only need to pause access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep member</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletePending}
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
            >
              {deletePending ? "Removing…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function TeamMemberRow({
  member,
  isAdmin,
  isSelf,
  onChanged,
}: {
  member: AdminUser
  isAdmin: boolean
  isSelf: boolean
  onChanged: () => void
}) {
  const [suspendPending, setSuspendPending] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deletePending, setDeletePending] = React.useState(false)

  async function toggleSuspend() {
    setSuspendPending(true)
    try {
      await apiPatch(`/api/admin/team/${member.id}`, {
        suspended: !member.suspended,
      })
      toast.success(
        member.suspended
          ? `${member.email} reactivated.`
          : `${member.email} suspended.`,
      )
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSuspendPending(false)
    }
  }

  async function confirmDelete() {
    setDeletePending(true)
    try {
      await apiDelete(`/api/admin/team/${member.id}`)
      toast.success(`${member.email} removed from the team.`)
      setDeleteOpen(false)
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <TableRow>
      <TableCell className="pl-4 font-medium">
        {member.name}
        {member.requiresPasswordReset && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            (pending setup)
          </span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{member.email}</TableCell>
      <TableCell className="text-muted-foreground">
        <div className="flex items-center gap-2">
          {ADMIN_ROLE_LABELS[member.role]}
          {member.suspended && (
            <Badge variant="secondary" className="text-amber-600">
              Suspended
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground tabular-nums">
        {member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "Never"}
      </TableCell>
      {isAdmin && (
        <TableCell className="pr-4 text-right">
          {isSelf ? (
            <span className="text-xs text-muted-foreground">You</span>
          ) : (
            <div className="flex items-center justify-end gap-0.5">
              <ResetPasswordControl
                member={member}
                onChanged={onChanged}
                variant="icon"
              />
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => void toggleSuspend()}
                disabled={suspendPending}
                aria-label={
                  member.suspended
                    ? `Reactivate ${member.email}`
                    : `Suspend ${member.email}`
                }
                title={member.suspended ? "Reactivate" : "Suspend"}
              >
                {member.suspended ? <CircleCheckIcon /> : <BanIcon />}
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
                aria-label={`Delete ${member.email}`}
                title="Delete"
              >
                <Trash2Icon />
              </Button>
            </div>
          )}
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                <AlertDialogDescription>
                  Permanently delete{" "}
                  <span className="font-medium text-foreground">
                    {member.email}
                  </span>
                  . They will lose access to the console immediately. Suspend
                  instead if you only need to pause access.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep member</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={deletePending}
                  onClick={(e) => {
                    e.preventDefault()
                    void confirmDelete()
                  }}
                >
                  {deletePending ? "Removing…" : "Delete permanently"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TableCell>
      )}
    </TableRow>
  )
}

type InviteResult = {
  user: AdminUser
  temporaryPassword: string
  emailSent?: boolean
  emailError?: string
}

function InviteAdminDialog({
  canInviteAdmins,
  onInvited,
}: {
  canInviteAdmins: boolean
  onInvited: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState<AdminRole>("operator")
  const [pending, setPending] = React.useState(false)
  const [inviteResult, setInviteResult] = React.useState<InviteResult | null>(
    null,
  )

  const roleItems = React.useMemo(() => {
    const items: Record<string, string> = {
      operator: ADMIN_ROLE_LABELS.operator,
    }
    if (canInviteAdmins) {
      items.admin = ADMIN_ROLE_LABELS.admin
    }
    return items
  }, [canInviteAdmins])

  function reset() {
    setEmail("")
    setRole("operator")
    setInviteResult(null)
    setPending(false)
  }

  async function submit() {
    if (!email.trim()) {
      toast.error("Enter an email address.")
      return
    }
    setPending(true)
    try {
      const result = await apiPost<InviteResult>("/api/admin/team/invite", {
        email: email.trim(),
        role,
      })
      setInviteResult(result)
      toast.success(
        result.emailSent
          ? `Invite email sent to ${result.user.email}.`
          : `Account created for ${result.user.email}.`,
      )
      onInvited()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function copyPassword() {
    if (!inviteResult?.temporaryPassword) return
    try {
      await navigator.clipboard.writeText(inviteResult.temporaryPassword)
      toast.success("Temporary password copied.")
    } catch {
      toast.error("Failed to copy password.")
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) reset()
      }}
    >
      <Button
        size="sm"
        className="h-10 w-full touch-manipulation sm:h-8 sm:w-auto"
        onClick={() => setOpen(true)}
      >
        <PlusIcon data-icon="inline-start" />
        Invite member
      </Button>
      <DialogContent className="sm:max-w-md">
        {inviteResult ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {inviteResult.emailSent
                  ? "Invite email sent"
                  : "Share login details"}
              </DialogTitle>
              <DialogDescription>
                {inviteResult.emailSent
                  ? `We emailed login details to ${inviteResult.user.email}. You can still copy the temporary password below as a backup.`
                  : `Could not send email${inviteResult.emailError ? ` (${inviteResult.emailError})` : ""}. Copy the temporary password below and share it with ${inviteResult.user.email} manually.`}
              </DialogDescription>
            </DialogHeader>
            <Field
              label="Temporary password"
              hint="They should sign in and change this password on first use."
            >
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={inviteResult.temporaryPassword}
                  className="font-mono"
                  aria-label="Temporary password"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyPassword}
                  aria-label="Copy temporary password"
                >
                  <CopyIcon />
                </Button>
              </div>
            </Field>
            <DialogFooter>
              <Button
                onClick={() => {
                  setOpen(false)
                  reset()
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Invite team member</DialogTitle>
              <DialogDescription>
                Create a new account. Operators can manage bookings, drivers,
                and pricing, but cannot delete them.
              </DialogDescription>
            </DialogHeader>
            <Field label="Email address" htmlFor="inviteEmail">
              <Input
                id="inviteEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return
                  if (e.key === "Enter") {
                    e.preventDefault()
                    submit()
                  }
                }}
                placeholder="name@company.com"
                autoFocus
              />
            </Field>
            <Field
              label="Role"
              htmlFor="inviteRole"
              hint={
                role === "operator"
                  ? "Cannot delete bookings, drivers, or pricing."
                  : "Full access, including permanent deletes."
              }
            >
              <Select
                value={role}
                onValueChange={(value) => {
                  if (value === "admin" || value === "operator") setRole(value)
                }}
                items={roleItems}
              >
                <SelectTrigger id="inviteRole" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">
                    {ADMIN_ROLE_LABELS.operator}
                  </SelectItem>
                  {canInviteAdmins ? (
                    <SelectItem value="admin">
                      {ADMIN_ROLE_LABELS.admin}
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </Field>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button onClick={submit} disabled={pending}>
                {pending ? "Creating…" : "Create account"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
