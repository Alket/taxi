import * as React from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function PanelCard({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <Card className="min-w-0 gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 p-4 md:p-6">
        {children}
      </CardContent>
      {footer && (
        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-4 py-3 md:px-6">
          {footer}
        </div>
      )}
    </Card>
  )
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function SaveButton({
  pending,
  dirty,
  onClick,
}: {
  pending: boolean
  dirty: boolean
  onClick: () => void
}) {
  return (
    <Button size="sm" onClick={onClick} disabled={pending || !dirty}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  )
}
