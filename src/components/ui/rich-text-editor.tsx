"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Youtube from "@tiptap/extension-youtube";
import { useEffect } from "react";
import {
  Bold,
  Italic,
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

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  function promptLink() {
    if (!editor) return;
    const existing = editor.getAttributes("link").href ?? "";
    const url = window.prompt("Link URL", existing || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const safe = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href: safe }).run();
  }

  function promptYoutube() {
    if (!editor) return;
    const url = window.prompt("YouTube URL", "https://www.youtube.com/watch?v=");
    if (!url) return;
    editor.chain().focus().setYoutubeVideo({ src: url, width: 640, height: 360 }).run();
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
      <ToolbarButton onClick={promptLink} active={editor.isActive("link")} title="Link">
        <Link2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      {editor.isActive("link") && (
        <ToolbarButton
          onClick={() => editor.chain().focus().unsetLink().run()}
          title="Remove link"
        >
          <Link2Off className="h-3.5 w-3.5" />
        </ToolbarButton>
      )}
      <ToolbarButton onClick={promptYoutube} title="Embed YouTube video">
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
      StarterKit.configure({ heading: { levels: [2, 3] } }),
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
