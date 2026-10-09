"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/**
 * Dev-only motion bench for the apple-design pass: every overlay and control
 * that carries spring motion, on one page, so changes to the tokens in
 * globals.css can be felt (and screenshotted mid-flight) without signing in.
 */
export default function MotionBenchPage() {
  const [on, setOn] = useState(true)
  const [plan, setPlan] = useState("growth")

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-8">
      <header>
        <h1 className="text-3xl font-semibold [font-family:var(--font-head)]">Motion bench</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Springs, materials and press feedback from the apple-design pass. Toggle reduced motion in
          your OS to see the cross-fade fallbacks.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-3" data-testid="overlays">
        <Dialog>
          <DialogTrigger render={<Button>Open dialog</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Publish this dashboard?</DialogTitle>
              <DialogDescription>Anyone with the link can view it. You can revoke the link at any time.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline">Cancel</Button>
              <Button>Publish</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet>
          <SheetTrigger render={<Button variant="outline">Open sheet</Button>} />
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Widget settings</SheetTitle>
              <SheetDescription>Slides in from the right and leaves the same way.</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline">Menu</Button>} />
          <DropdownMenuContent>
            <DropdownMenuItem>Rename</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover>
          <PopoverTrigger render={<Button variant="outline">Popover</Button>} />
          <PopoverContent>
            <p className="text-sm font-medium">Scales out of its trigger</p>
            <p className="text-muted-foreground">The origin follows the side it opens on.</p>
          </PopoverContent>
        </Popover>

        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost">Hover me</Button>} />
          <TooltipContent>Tooltip</TooltipContent>
        </Tooltip>

        <Select value={plan} onValueChange={(v) => v && setPlan(v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="growth">Growth</SelectItem>
            <SelectItem value="scale">Scale</SelectItem>
          </SelectContent>
        </Select>
      </section>

      <section className="flex flex-col gap-4">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="drafts">Drafts</TabsTrigger>
            <TabsTrigger value="published">Published</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="text-sm text-muted-foreground">The selection glides between tabs.</TabsContent>
          <TabsContent value="drafts" className="text-sm text-muted-foreground">Drafts</TabsContent>
          <TabsContent value="published" className="text-sm text-muted-foreground">Published</TabsContent>
        </Tabs>
        <Tabs defaultValue="identity">
          <TabsList variant="line">
            <TabsTrigger value="identity">Identity</TabsTrigger>
            <TabsTrigger value="audience">Audience</TabsTrigger>
            <TabsTrigger value="voice">Voice</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-6 text-sm">
          <label className="flex items-center gap-2">
            <Switch checked={on} onCheckedChange={setOn} /> Auto-publish
          </label>
          <label className="flex items-center gap-2">
            <Checkbox defaultChecked /> Notify me
          </label>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card interactive>
          <CardHeader>
            <CardTitle>Interactive card</CardTitle>
            <CardDescription>Lifts on hover, presses in on pointer-down.</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground">Try holding the mouse down.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Static card</CardTitle>
            <CardDescription>No motion: it isn&apos;t clickable.</CardDescription>
          </CardHeader>
        </Card>
      </section>
    </div>
  )
}
