"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Youtube from "@tiptap/extension-youtube";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import { useEffect, useState } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link2,
  Link2Off,
  Heading2,
  Video,
  Undo2,
  Redo2,
  Code,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Normalise stored content. Older tasks/comments were plain text — wrap
 * those in a paragraph so Tiptap can render them. Already-HTML content
 * passes through unchanged.
 */
function normaliseContent(value: string): string {
  if (!value) return "";
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(value);
  if (looksLikeHtml) return value;
  return `<p>${value.replace(/</g, "&lt;").replace(/\n/g, "<br/>")}</p>`;
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // don't steal focus from the editor
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-primary/10 text-primary hover:bg-primary/15"
      )}
    >
      {children}
    </button>
  );
}

function UrlDialog({
  open,
  onOpenChange,
  title,
  label,
  initialValue,
  submitLabel,
  helpText,
  onSubmit,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  label: string;
  initialValue: string;
  submitLabel: string;
  helpText?: string;
  // Return a string to show an error without closing; return null on success.
  onSubmit: (url: string) => string | null | void;
  onRemove?: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setError("");
    }
  }, [open, initialValue]);

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Please enter a URL.");
      return;
    }
    const result = onSubmit(trimmed);
    if (typeof result === "string" && result.length > 0) {
      setError(result);
      return;
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </label>
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="https://"
            autoFocus
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          />
          {helpText && !error && (
            <p className="mt-2 text-[11px] text-muted-foreground">{helpText}</p>
          )}
          {error && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
        <div className="-mx-4 -mb-4 flex items-center justify-between gap-2 rounded-b-xl border-t border-border bg-muted/40 px-4 py-3">
          <div>
            {onRemove && initialValue && (
              <button
                type="button"
                onClick={() => {
                  onRemove();
                  onOpenChange(false);
                }}
                className="rounded-xl px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                Remove link
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!value.trim()}
              className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitLabel}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [linkInitial, setLinkInitial] = useState("");

  if (!editor) return null;

  function openLinkDialog() {
    if (!editor) return;
    setLinkInitial(editor.getAttributes("link").href ?? "");
    setLinkOpen(true);
  }

  function applyLink(url: string) {
    if (!editor) return;
    const safe = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: safe })
      .run();
  }

  function removeLink() {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
  }

  /**
   * Insert a video embed. Handles YouTube + Vimeo; shows a clear error for
   * anything else. Tiptap's YouTube extension accepts several URL shapes
   * (youtu.be, youtube.com/watch, shorts) and throws if it can't parse them —
   * we catch that and surface it rather than silently doing nothing.
   */
  function applyVideo(rawUrl: string): string | null {
    if (!editor) return null;
    const url = rawUrl.trim();
    if (!url) return "Please enter a URL.";

    const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;

    const isYouTube = /(?:youtube\.com|youtu\.be)/i.test(withProto);
    const vimeoMatch = withProto.match(
      /vimeo\.com\/(?:video\/)?(\d+)/i,
    );

    if (isYouTube) {
      try {
        const ok = editor
          .chain()
          .focus()
          .setYoutubeVideo({ src: withProto, width: 640, height: 360 })
          .run();
        if (!ok) {
          return "Couldn't read that YouTube link. Try the full https://www.youtube.com/watch?v=… or https://youtu.be/… URL.";
        }
        return null;
      } catch {
        return "Couldn't embed that YouTube link. Try copying the URL straight from the browser address bar.";
      }
    }

    if (vimeoMatch) {
      const id = vimeoMatch[1];
      const embed = `<div data-video-embed="vimeo"><iframe src="https://player.vimeo.com/video/${id}" width="640" height="360" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen class="w-full aspect-video rounded-lg"></iframe></div><p></p>`;
      editor.chain().focus().insertContent(embed).run();
      return null;
    }

    return "Only YouTube and Vimeo URLs can be embedded. For other videos, use the Link button instead.";
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-2 py-1">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Bold"
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Italic"
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
        title="Underline"
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        title="Heading"
      >
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <span className="mx-0.5 h-4 w-px bg-border" />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="Bulleted list"
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="Numbered list"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive("code")}
        title="Inline code"
      >
        <Code className="h-3.5 w-3.5" />
      </ToolbarButton>
      <span className="mx-0.5 h-4 w-px bg-border" />
      <ToolbarButton
        onClick={openLinkDialog}
        active={editor.isActive("link")}
        title="Link"
      >
        <Link2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      {editor.isActive("link") && (
        <ToolbarButton onClick={removeLink} title="Remove link">
          <Link2Off className="h-3.5 w-3.5" />
        </ToolbarButton>
      )}
      <ToolbarButton
        onClick={() => setVideoOpen(true)}
        title="Embed video (YouTube or Vimeo)"
      >
        <Video className="h-3.5 w-3.5" />
      </ToolbarButton>
      <span className="mx-0.5 h-4 w-px bg-border" />
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        title="Undo"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        title="Redo"
      >
        <Redo2 className="h-3.5 w-3.5" />
      </ToolbarButton>

      <UrlDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        title={linkInitial ? "Edit link" : "Add link"}
        label="Link URL"
        initialValue={linkInitial}
        submitLabel={linkInitial ? "Update" : "Add link"}
        onSubmit={applyLink}
        onRemove={removeLink}
      />
      <UrlDialog
        open={videoOpen}
        onOpenChange={setVideoOpen}
        title="Embed video"
        label="YouTube or Vimeo URL"
        helpText="Paste a link from YouTube (youtube.com / youtu.be) or Vimeo (vimeo.com). For other videos, use the Link button instead."
        initialValue=""
        submitLabel="Embed"
        onSubmit={(url) => applyVideo(url)}
      />
    </div>
  );
}

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  onBlur?: (html: string) => void;
  placeholder?: string;
  /** Compact chrome for comment composer. */
  compact?: boolean;
  className?: string;
  minHeight?: number;
}

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  compact = false,
  className,
  minHeight = 120,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      // StarterKit v3 bundles Link and Underline. We register our own
      // configured versions below (Link needs openOnClick/target/rel),
      // so disable the bundled ones to avoid duplicate-extension warnings.
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: false,
        underline: false,
      }),
      Underline,
      // Demo-step photos (and any pasted images) are preserved as
      // proper image nodes. StarterKit has no image node, so without
      // this the <img> tags get dropped on insert.
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: "rounded-lg max-w-xs my-2" },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "text-primary underline",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      Youtube.configure({
        controls: true,
        nocookie: true,
        HTMLAttributes: { class: "w-full aspect-video rounded-lg" },
      }),
    ],
    content: normaliseContent(value),
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none px-3 py-2 outline-none",
          "prose-headings:font-semibold prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5",
          "dark:prose-invert"
        ),
        "data-placeholder": placeholder ?? "",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.isEmpty ? "" : editor.getHTML());
    },
    onBlur: ({ editor }) => {
      if (onBlur) onBlur(editor.isEmpty ? "" : editor.getHTML());
    },
    immediatelyRender: false,
  });

  // Keep editor content in sync if the external value changes (e.g. after save).
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = normaliseContent(value);
    if (current !== incoming && !editor.isFocused) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [value, editor]);

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20",
        className
      )}
    >
      <Toolbar editor={editor} />
      {compact ? null : null}
      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
