"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { TextAlign } from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { useEffect } from "react";
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
    Table as TableIcon, Heading2, Heading3, Undo, Redo,
    Minus, CornerDownLeft,
} from "lucide-react";

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    minHeight?: string;
    disabled?: boolean;
}

const ToolbarButton = ({
    onClick, active, title, children, disabled,
}: {
    onClick: () => void;
    active?: boolean;
    title: string;
    children: React.ReactNode;
    disabled?: boolean;
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`p-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            active
                ? "bg-[#1a237e] text-white"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`}
    >
        {children}
    </button>
);

const Separator = () => <div className="w-px h-5 bg-gray-200 mx-0.5 self-center" />;

export default function RichTextEditor({
    value,
    onChange,
    placeholder = "Rédigez votre réponse ici…",
    minHeight = "180px",
    disabled = false,
}: RichTextEditorProps) {
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({ codeBlock: false }),
            Underline,
            TextAlign.configure({ types: ["heading", "paragraph"] }),
            Table.configure({ resizable: false }),
            TableRow,
            TableHeader,
            TableCell,
        ],
        content: value || "",
        editable: !disabled,
        onUpdate({ editor }) {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: "prose prose-sm max-w-none focus:outline-none px-4 py-3 text-gray-900 leading-relaxed",
                style: `min-height: ${minHeight}`,
            },
        },
    });

    // Sync external value changes (e.g., reset)
    useEffect(() => {
        if (editor && value === "" && editor.getHTML() !== "<p></p>") {
            editor.commands.clearContent();
        }
    }, [value, editor]);

    useEffect(() => {
        editor?.setEditable(!disabled);
    }, [disabled, editor]);

    if (!editor) return null;

    const insertTable = () =>
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();

    return (
        <div
            className={`border rounded-xl overflow-hidden shadow-sm bg-white transition-all ${
                disabled ? "opacity-70" : "focus-within:ring-2 focus-within:ring-[#1a237e33] focus-within:border-[#1a237e]"
            }`}
            style={{ borderColor: "#d1d5db" }}
        >
            {/* Toolbar */}
            {!disabled && (
                <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-gray-100 bg-gray-50">
                    {/* History */}
                    <ToolbarButton title="Annuler" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
                        <Undo className="h-3.5 w-3.5" />
                    </ToolbarButton>
                    <ToolbarButton title="Rétablir" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
                        <Redo className="h-3.5 w-3.5" />
                    </ToolbarButton>
                    <Separator />

                    {/* Headings */}
                    <ToolbarButton
                        title="Titre 2"
                        active={editor.isActive("heading", { level: 2 })}
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    >
                        <Heading2 className="h-3.5 w-3.5" />
                    </ToolbarButton>
                    <ToolbarButton
                        title="Titre 3"
                        active={editor.isActive("heading", { level: 3 })}
                        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    >
                        <Heading3 className="h-3.5 w-3.5" />
                    </ToolbarButton>
                    <Separator />

                    {/* Inline formatting */}
                    <ToolbarButton title="Gras" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
                        <Bold className="h-3.5 w-3.5" />
                    </ToolbarButton>
                    <ToolbarButton title="Italique" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
                        <Italic className="h-3.5 w-3.5" />
                    </ToolbarButton>
                    <ToolbarButton title="Souligné" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
                        <UnderlineIcon className="h-3.5 w-3.5" />
                    </ToolbarButton>
                    <ToolbarButton title="Barré" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
                        <Strikethrough className="h-3.5 w-3.5" />
                    </ToolbarButton>
                    <Separator />

                    {/* Lists */}
                    <ToolbarButton
                        title="Liste à puces"
                        active={editor.isActive("bulletList")}
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                    >
                        <List className="h-3.5 w-3.5" />
                    </ToolbarButton>
                    <ToolbarButton
                        title="Liste numérotée"
                        active={editor.isActive("orderedList")}
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    >
                        <ListOrdered className="h-3.5 w-3.5" />
                    </ToolbarButton>
                    <Separator />

                    {/* Alignment */}
                    <ToolbarButton
                        title="Aligner à gauche"
                        active={editor.isActive({ textAlign: "left" })}
                        onClick={() => editor.chain().focus().setTextAlign("left").run()}
                    >
                        <AlignLeft className="h-3.5 w-3.5" />
                    </ToolbarButton>
                    <ToolbarButton
                        title="Centrer"
                        active={editor.isActive({ textAlign: "center" })}
                        onClick={() => editor.chain().focus().setTextAlign("center").run()}
                    >
                        <AlignCenter className="h-3.5 w-3.5" />
                    </ToolbarButton>
                    <ToolbarButton
                        title="Aligner à droite"
                        active={editor.isActive({ textAlign: "right" })}
                        onClick={() => editor.chain().focus().setTextAlign("right").run()}
                    >
                        <AlignRight className="h-3.5 w-3.5" />
                    </ToolbarButton>
                    <Separator />

                    {/* Table */}
                    <ToolbarButton title="Insérer un tableau (3×3)" onClick={insertTable}>
                        <TableIcon className="h-3.5 w-3.5" />
                    </ToolbarButton>
                    <Separator />

                    {/* Block extras */}
                    <ToolbarButton title="Ligne de séparation" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
                        <Minus className="h-3.5 w-3.5" />
                    </ToolbarButton>
                    <ToolbarButton title="Saut de ligne forcé" onClick={() => editor.chain().focus().setHardBreak().run()}>
                        <CornerDownLeft className="h-3.5 w-3.5" />
                    </ToolbarButton>
                </div>
            )}

            {/* Editor area */}
            <div className="relative">
                {editor.isEmpty && (
                    <p className="absolute top-3 left-4 text-gray-400 text-sm pointer-events-none select-none">
                        {placeholder}
                    </p>
                )}
                <EditorContent editor={editor} />
            </div>

            {/* Table context toolbar (appears when cursor is inside a table) */}
            {!disabled && editor.isActive("table") && (
                <div className="flex flex-wrap gap-1 px-3 py-2 border-t border-blue-100 bg-blue-50 text-xs">
                    <span className="text-blue-700 font-bold mr-2">Tableau :</span>
                    <button type="button" className="text-blue-700 hover:underline" onClick={() => editor.chain().focus().addColumnBefore().run()}>+ Colonne avant</button>
                    <button type="button" className="text-blue-700 hover:underline" onClick={() => editor.chain().focus().addColumnAfter().run()}>+ Colonne après</button>
                    <button type="button" className="text-blue-700 hover:underline" onClick={() => editor.chain().focus().deleteColumn().run()}>- Colonne</button>
                    <span className="text-blue-400">|</span>
                    <button type="button" className="text-blue-700 hover:underline" onClick={() => editor.chain().focus().addRowBefore().run()}>+ Ligne avant</button>
                    <button type="button" className="text-blue-700 hover:underline" onClick={() => editor.chain().focus().addRowAfter().run()}>+ Ligne après</button>
                    <button type="button" className="text-blue-700 hover:underline" onClick={() => editor.chain().focus().deleteRow().run()}>- Ligne</button>
                    <span className="text-blue-400">|</span>
                    <button type="button" className="text-rose-600 hover:underline" onClick={() => editor.chain().focus().deleteTable().run()}>Supprimer tableau</button>
                </div>
            )}

            {/* Prose / table styles injected globally */}
            <style>{`
                .ProseMirror table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 0.75rem 0;
                }
                .ProseMirror td, .ProseMirror th {
                    border: 1px solid #d1d5db;
                    padding: 6px 10px;
                    min-width: 60px;
                    vertical-align: top;
                }
                .ProseMirror th {
                    background-color: #f3f4f6;
                    font-weight: 600;
                }
                .ProseMirror .selectedCell {
                    background-color: #e8eaf6;
                }
                .ProseMirror blockquote {
                    border-left: 3px solid #c5cae9;
                    margin: 0.5rem 0;
                    padding-left: 1rem;
                    color: #6b7280;
                }
                .ProseMirror h2 { font-size: 1.2rem; font-weight: 700; margin: 0.75rem 0 0.25rem; }
                .ProseMirror h3 { font-size: 1.05rem; font-weight: 600; margin: 0.5rem 0 0.25rem; }
                .ProseMirror ul, .ProseMirror ol { padding-left: 1.5rem; margin: 0.25rem 0; }
                .ProseMirror li { margin: 0.1rem 0; }
                .ProseMirror hr { border: none; border-top: 2px solid #e5e7eb; margin: 0.75rem 0; }
            `}</style>
        </div>
    );
}
