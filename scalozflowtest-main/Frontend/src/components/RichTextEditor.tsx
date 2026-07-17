import React, { useState, useEffect, useRef } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  CheckSquare,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Code,
  Quote,
  Minus,
  Smile,
  Search,
  Undo,
  Redo,
  Sparkles,
  Paperclip,
  Trash2,
  Plus,
  Check,
  Type
} from 'lucide-react';
import DOMPurify from 'dompurify';
import api from '../services/api';
import type { User } from '../types';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  draftKey?: string;
  projectId?: number;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write something...',
  draftKey,
  projectId
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textColorPickerRef = useRef<HTMLDivElement>(null);
  const highlightColorPickerRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  
  // States
  const [users, setUsers] = useState<User[]>([]);
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionCoords, setMentionCoords] = useState({ top: 0, left: 0 });

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const lastSelectionRangeRef = useRef<Range | null>(null);

  // Common Emojis
  const emojiScrollRef = useRef<HTMLDivElement>(null);
  const [emojiSearchQuery, setEmojiSearchQuery] = useState('');

  // Structured Emoji Categories (Jira style)
  const emojiCategories = [
    {
      id: 'people',
      name: 'Smileys & People',
      emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🫣', '🤭', '🫢', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '😵‍💫', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾']
    },
    {
      id: 'nature',
      name: 'Animals & Nature',
      emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦤', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🐙', '🦑', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🦣', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐖', '🐏', '🐑', '🐐', '🦌', '🐕', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥', '🐁', '🐿️', '🦔', '🐾', '🐉', '🌵', '🎄', '🌲', '🌳', '🌴', '🪵', '🌱', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃']
    },
    {
      id: 'food',
      name: 'Food & Drink',
      emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '茄', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🍳', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🥗', '🥘', '🍲', '🥣', '🍿', '🧂', '🥫', '🍱', '🍘', '🍙', '🍚', '🍛', '🍜', '🍝', '🍢', '🍣', '🍤', '🍥', '🫖', '🍵', '☕', '🥤', '🧋', '🥛', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯']
    },
    {
      id: 'activity',
      name: 'Activity',
      emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', ' sled', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤸', '🤼', '🤽', '🤾', '🚴', '🚵', '🧗', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎫', '🎟️', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🪗', '🎸', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩']
    },
    {
      id: 'places',
      name: 'Travel & Places',
      emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚜', '🛵', '🏍️', '🛺', '🚲', '🛴', '🗺️', '🧭', '🏔️', '🌋', '🗻', '🏕️', '⛺', '🛖', '🏠', '🏢', '郵', '🏥', '🏦', '🏨', '🏫', '🏭', '🏯', '🏰', '💒', '🗼', '🗽', '⛪', '🕌', '🛕', '🕋', '⛲', '⛺', '🌁', '🌃', '🌆', '🌇', '🌉', '🎠', '🎡', '🎢', '🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚈', '🚉', '🏖️', '🏝️', '🏜️']
    },
    {
      id: 'objects',
      name: 'Objects',
      emojis: ['⌚', '📱', '📲', '💻', '键盘', '鼠标', '🖥️', '🖨️', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏰', '⌛', '⏳', '💡', '🔦', '🕯️', '🪔', '💵', '💴', '💶', '💷', '🪙', '💸', '💳', '🧾', '✉️', '📧', '📨', '📩', '📤', '📥', '📦', '📮', '🗳️', '✏️', '✒️', '🖋️', '🖊️', '🖌️', '🖍️', '📝', '📁', '📂', '📅', '📆', '🗒️', '🗓️', '📇', '📈', '📉', '📊', '📋', '📌', '📍', '📎', '🖇️', '📏', '📐', '✂️', '🗃️', '🗄️', '🗑️', '🔒', '🔓', '🔏', '🔐', '🔑', '🗝️', '🔨', '🪓', '⚒️', '🛠️', '🗡️', '⚔️', '🛡️', '🪚', '🔧', '🪛', '🔩', '⚙️', '🗜️', '⚖️', '🔗', '⛓️', '🪝', '🧪', '🧫', '🧬', '🔬', '🔭', '📡', '💉', '🩸', '💊', '🩹', '🩺', '🚪', '🛗', '🪞', '🪟', '🛏️', '🛋️', '🪑', '🚽', '🪠', '🚿', '🛁', '🧹', '🧺', '𧛏️', '🧼', '🧽', '🧯', '🛒']
    },
    {
      id: 'symbols',
      name: 'Symbols',
      emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '📳', '📴', '⚕️', '♾️', '♻️', '☣️', '☢️', '🔀', '🔁', '🔂', '▶️', '⏩', '⏭️', '⏯️', '◀️', '⏪', '⏮️', '🔼', '🚀', '🛸', '🎦', '📶']
    },
    {
      id: 'flags',
      name: 'Flags',
      emojis: ['🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇫', '🇦🇽', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼', '🇦🇺', '🇦🇹', '🇦🇿', '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪', '🇧🇿', '🇧🇯', '🇧🇲', '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇨🇲', '🇨🇦', '🇨🇻', '🇨🇱', '🇨🇳', '🇨🇴', '🇨🇷', '🇨🇮', '🇭🇷', '🇨🇺', '🇨🇾', '🇨🇿', '🇩🇰', '🇩🇯', '🇩🇲', '🇩🇴', '🇪🇨', '🇪🇬', '🇸🇻', '🇪🇪', '🇪🇹', '🇫🇯', '🇫🇮', '🇫🇷', '🇬🇦', '🇬🇲', '🇬🇪', '🇩🇪', '🇬🇭', '🇬🇮', '🇬🇷', '🇬🇱', '🇬🇩', '🇬🇵', '🇬🇺', '🇬🇹', '🇭🇹', '🇭🇳', '🇭🇰', '🇭🇺', '🇮🇸', '🇮🇳', '🇮🇩', '🇮🇷', '🇮🇶', '🇮🇪', '🇮🇱', '🇮🇹', '🇯🇲', '🇯🇵', '🇯🇴', '🇰🇿', '🇰🇪', '🇰🇼', '🇰🇬', '🇱🇦', '🇱🇻', '🇱🇧', '🇱🇾', '🇱🇮', '🇱🇹', '🇱🇺', '🇲🇬', '🇲🇼', '🇲🇾', '🇲🇻', '🇲🇱', '🇲🇹', '🇲🇽', '🇲🇨', '🇲🇳', '🇲🇪', '🇲🇦', '🇲🇿', '🇲🇲', '🇳🇦', '🇳🇵', '🇳🇱', '🇳🇿', '🇳🇮', '🇳🇪', '🇳🇬', '🇰🇵', '🇲🇰', '🇳🇴', '🇴🇲', '🇵🇰', '🇵🇸', '🇵🇦', '🇵🇬', '🇵🇾', '🇵🇪', '🇵🇭', '🇵🇱', '🇵🇹', '🇵🇷', '🇶🇦', '🇷🇴', '🇷🇺', '🇷🇼', '🇼🇸', '🇸🇲', '🇸🇦', '🇸🇳', '🇷🇸', '🇸🇨', '🇸🇱', '🇸🇬', '🇸🇰', '🇸🇮', '🇿🇦', '🇪🇸', '🇱🇰', '🇸🇩', '🇸🇪', '🇨🇭', '🇸🇾', '🇹🇼', '🇹🇯', '🇹🇿', '🇹🇭', '🇹🇬', '🇹🇴', '🇹🇹', '🇹🇳', '🇹🇷', '🇺🇬', '🇺🇦', '🇦🇪', '🇬🇧', '🇺🇸', '🇺🇾', '🇺🇿', '🇻🇪', '🇻🇳', '🇾🇪', '🇿🇲', '🇿🇼']
    },
    {
      id: 'productivity',
      name: 'Atlassian & Productivity',
      emojis: ['✅', '☑️', '✔️', '🚀', '🎯', '📈', '📅', '📆', '🗓️', '🔔', '📝', '💻', '📊', '📋', '📌', '📍', '📎', '🧠', '💡', '🔍', '🛠️', '🤝', '🏆', '✨', '⭐', '🔥']
    }
  ];

  const [selectedTextColor, setSelectedTextColor] = useState('#172B4D');
  const [selectedHighlightColor, setSelectedHighlightColor] = useState('transparent');

  // Colors (3 rows x 7 columns grid to match Jira palette)
  const textColors = [
    '#172B4D', '#0747A6', '#006687', '#006644', '#D97706', '#9E250E', '#403294',
    '#6B778C', '#2684FF', '#00A3BF', '#36B37E', '#FFAB00', '#FF5630', '#6554C0',
    '#FFFFFF', '#DEEBFF', '#E6FCFF', '#E3FCEF', '#FFF0B3', '#FFEBE6', '#EAE6FF'
  ];
  const highlightColors = [
    '#172B4D', '#0747A6', '#006687', '#006644', '#D97706', '#9E250E', '#403294',
    '#6B778C', '#2684FF', '#00A3BF', '#36B37E', '#FFAB00', '#FF5630', '#6554C0',
    '#FFFFFF', '#DEEBFF', '#E6FCFF', '#E3FCEF', '#FFF0B3', '#FFEBE6', '#EAE6FF'
  ];

  useEffect(() => {
    // Fetch users for @mention suggestions
    const fetchUsers = async () => {
      try {
        const res = await api.get(projectId ? `/auth/users?projectId=${projectId}` : '/auth/users');
        setUsers(res.data || []);
      } catch (err) {
        console.error('Failed to fetch users in RichTextEditor:', err);
      }
    };
    fetchUsers();

    // Check draft key
    if (draftKey) {
      const savedDraft = localStorage.getItem(`editor_draft_${draftKey}`);
      if (savedDraft && savedDraft !== value) {
        setHasDraft(true);
      }
    }
  }, [projectId, draftKey]);

  // Keep track of the last cursor position/selection within the editor
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        // Save range only if it's within our rich text editor
        if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
          lastSelectionRangeRef.current = range;
        }
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  // Set initial content if editor is empty
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      // Avoid resetting cursor if focused
      if (document.activeElement !== editorRef.current) {
        editorRef.current.innerHTML = value || '';
      }
    }
  }, [value]);

  // Close color and emoji pickers on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (showColorPicker && textColorPickerRef.current && !textColorPickerRef.current.contains(target)) {
        setShowColorPicker(false);
      }
      if (showHighlightPicker && highlightColorPickerRef.current && !highlightColorPickerRef.current.contains(target)) {
        setShowHighlightPicker(false);
      }
      if (showEmojiPicker && emojiPickerRef.current && !emojiPickerRef.current.contains(target)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColorPicker, showHighlightPicker, showEmojiPicker]);

  const handleInput = () => {
    if (editorRef.current) {
      const rawHtml = editorRef.current.innerHTML;
      const cleanHtml = DOMPurify.sanitize(rawHtml, {
        ADD_TAGS: ['iframe', 'embed'],
        ADD_ATTR: ['src', 'style', 'controls', 'target', 'contenteditable']
      });
      onChange(cleanHtml);

      // Save Draft
      if (draftKey) {
        localStorage.setItem(`editor_draft_${draftKey}`, cleanHtml);
        setHasDraft(false);
      }

      // Check for mentions trigger
      checkMentionTrigger();
    }
  };

  const restoreDraft = () => {
    if (draftKey) {
      const savedDraft = localStorage.getItem(`editor_draft_${draftKey}`);
      if (savedDraft) {
        if (editorRef.current) {
          editorRef.current.innerHTML = savedDraft;
        }
        onChange(savedDraft);
        setHasDraft(false);
      }
    }
  };

  const discardDraft = () => {
    if (draftKey) {
      localStorage.removeItem(`editor_draft_${draftKey}`);
      setHasDraft(false);
    }
  };

  const exec = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    handleInput();
  };

  // Selection helper
  const saveSelection = (): Range | null => {
    const sel = window.getSelection();
    return sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
  };

  const restoreSelection = (range: Range | null) => {
    if (range) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  };

  // Custom Table Insertion
  const insertTable = () => {
    const tableHtml = `
      <table class="rich-editor-table border-collapse border border-gray-300 my-4 w-full">
        <tbody>
          <tr>
            <td class="border border-gray-300 p-2 min-w-[50px] bg-gray-50">Header 1</td>
            <td class="border border-gray-300 p-2 min-w-[50px] bg-gray-50">Header 2</td>
          </tr>
          <tr>
            <td class="border border-gray-300 p-2 min-w-[50px]">Data 1</td>
            <td class="border border-gray-300 p-2 min-w-[50px]">Data 2</td>
          </tr>
        </tbody>
      </table>
    `;
    exec('insertHTML', tableHtml);
  };

  // Custom Checklist Insertion
  const insertChecklist = () => {
    const checklistHtml = `
      <ul class="editor-checklist list-none pl-0">
        <li class="flex items-start gap-2 my-1">
          <input type="checkbox" class="mt-1 cursor-pointer" onclick="this.setAttribute('checked', this.checked ? 'true' : '')" />
          <span class="outline-none" contenteditable="true">Todo item</span>
        </li>
      </ul>
    `;
    exec('insertHTML', checklistHtml);
  };

  // Inline Code Insertion
  const insertInlineCode = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const selectedText = range.toString() || 'code';
    const codeHtml = `<code class="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded font-mono text-sm">${selectedText}</code>`;
    exec('insertHTML', codeHtml);
  };

  // Code Block Insertion
  const insertCodeBlock = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const selectedText = range.toString() || 'write code here...';
    const codeBlockHtml = `
      <pre class="bg-gray-900 text-gray-100 p-4 rounded-md font-mono text-sm my-3 overflow-x-auto"><code class="block leading-relaxed">${selectedText}</code></pre>
    `;
    exec('insertHTML', codeBlockHtml);
  };

  // Link Dialog
  const insertLink = () => {
    const url = prompt('Enter website link URL:');
    if (url) {
      exec('createLink', url);
    }
  };

  // Mention Autocomplete Trigger detection
  const checkMentionTrigger = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const container = range.startContainer;

    if (container.nodeType === Node.TEXT_NODE) {
      const text = container.textContent || '';
      const offset = range.startOffset;
      const beforeCaret = text.slice(0, offset);
      const match = beforeCaret.match(/(?:^|\s)@([^\s]*)$/);

      if (match) {
        setMentionSearch(match[1].toLowerCase());
        setMentionIndex(0);
        
        // Calculate coords of caret for mention popup
        const rect = range.getBoundingClientRect();
        setMentionCoords({
          top: rect.bottom + window.scrollY + 5,
          left: rect.left + window.scrollX
        });
      } else {
        setMentionSearch(null);
      }
    } else {
      setMentionSearch(null);
    }
  };

  const handleMentionSelect = (user: User) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const container = range.startContainer;

    if (container.nodeType === Node.TEXT_NODE) {
      const text = container.textContent || '';
      const offset = range.startOffset;
      const beforeCaret = text.slice(0, offset);
      const match = beforeCaret.match(/(?:^|\s)@([^\s]*)$/);

      if (match) {
        const start = offset - match[1].length - 1; // back to @
        range.setStart(container, start);
        range.setEnd(container, offset);
        range.deleteContents();

        const mentionSpan = document.createElement('span');
        mentionSpan.className = 'editor-mention px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-[3px] font-bold text-xs pointer-events-none select-all';
        mentionSpan.textContent = `@${user.name}`;
        mentionSpan.dataset.empId = user.empId;
        
        range.insertNode(mentionSpan);
        
        // Add a space after the mention
        const spaceNode = document.createTextNode(' ');
        mentionSpan.after(spaceNode);
        
        // Place caret after the space
        const newRange = document.createRange();
        newRange.setStart(spaceNode, 1);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    }
    setMentionSearch(null);
    handleInput();
  };

  // Keyboard Navigation for Mention popup and keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Shortcuts
    if (e.ctrlKey) {
      if (e.key === 'b') {
        e.preventDefault();
        exec('bold');
      } else if (e.key === 'i') {
        e.preventDefault();
        exec('italic');
      } else if (e.key === 'u') {
        e.preventDefault();
        exec('underline');
      } else if (e.key === 'k') {
        e.preventDefault();
        insertLink();
      } else if (e.key === 'z') {
        e.preventDefault();
        exec('undo');
      } else if (e.key === 'y') {
        e.preventDefault();
        exec('redo');
      }
    }

    // Mention Dropdown Control
    if (mentionSearch !== null) {
      const filtered = filteredUsers;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[mentionIndex]) {
          handleMentionSelect(filtered[mentionIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setMentionSearch(null);
      }
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(mentionSearch || '') ||
    u.email.toLowerCase().includes(mentionSearch || '')
  );

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(f => insertFileNode(f));
    }
    e.target.value = '';
  };

  const insertFileNode = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;

      const fileHtml = file.type.startsWith('image/')
        ? `<img src="${dataUrl}" alt="${file.name}" style="max-width: 100%; height: auto; border-radius: 4px; display: inline-block; margin: 8px 0;" />`
        : `<a href="${dataUrl}" download="${file.name}" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F4F5F7] border border-[#DFE1E6] hover:bg-white text-blue-600 hover:text-blue-800 rounded font-semibold text-xs transition-colors my-2" contenteditable="false"><span class="shrink-0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></span>${file.name}</a>`;

      // Force focus editor and restore previous selection range so execCommand inserts at the correct place
      if (editorRef.current) {
        editorRef.current.focus();
      }
      
      const sel = window.getSelection();
      if (lastSelectionRangeRef.current) {
        restoreSelection(lastSelectionRangeRef.current);
      } else {
        // Fallback: move cursor to end of editor
        const range = document.createRange();
        range.selectNodeContents(editorRef.current!);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }

      document.execCommand('insertHTML', false, fileHtml);
      handleInput();
    };

    reader.readAsDataURL(file);
  };

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor) {
      const href = anchor.getAttribute('href');
      if (href) {
        e.preventDefault();
        window.open(href, '_blank');
      }
    }
  };

  // Clipboard paste support (Screenshots & Links)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    let hasImage = false;
    
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            insertFileNode(file);
            hasImage = true;
            break;
          }
        }
      }
    }

    if (!hasImage) {
      const text = e.clipboardData.getData('text/plain');
      if (text.includes('http://') || text.includes('https://') || text.includes('www.')) {
        const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
        const html = text.replace(urlRegex, (url) => {
          const href = url.startsWith('www.') ? `https://${url}` : url;
          return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color: #1F6FEB; text-decoration: underline;">${url}</a>`;
        });
        if (html !== text) {
          e.preventDefault();
          const htmlWithLineBreaks = html.replace(/\n/g, '<br>');
          document.execCommand('insertHTML', false, htmlWithLineBreaks);
          handleInput();
        }
      }
    }
  };

  // Drag & drop support
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(f => insertFileNode(f));
    }
  };

  return (
    <div className="relative border-2 border-[#DFE1E6] rounded-md bg-white focus-within:border-[#4C9AFF] transition-all flex flex-col font-sans">
      
      {/* Draft Notification Banner */}
      {hasDraft && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 animate-in fade-in duration-300">
          <div className="flex items-center gap-1.5 font-medium">
            <Sparkles size={14} className="text-amber-600 shrink-0" />
            <span>Unsaved draft found for this description.</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={restoreDraft}
              className="font-bold text-amber-900 hover:underline cursor-pointer"
            >
              Restore Draft
            </button>
            <button
              onClick={discardDraft}
              className="text-amber-600 hover:text-amber-900 cursor-pointer"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Editor Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-[#FAFBFC] border-b border-[#DFE1E6] rounded-t-md select-none">
        
        {/* Undo / Redo */}
        <button
          type="button"
          onClick={() => exec('undo')}
          title="Undo (Ctrl+Z)"
          className="p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer"
        >
          <Undo size={14} />
        </button>
        <button
          type="button"
          onClick={() => exec('redo')}
          title="Redo (Ctrl+Y)"
          className="p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer"
        >
          <Redo size={14} />
        </button>

        <div className="w-px h-5 bg-[#DFE1E6] mx-1" />

        {/* Text Formats */}
        <button
          type="button"
          onClick={() => exec('bold')}
          title="Bold (Ctrl+B)"
          className="p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer"
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          onClick={() => exec('italic')}
          title="Italic (Ctrl+I)"
          className="p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer"
        >
          <Italic size={14} />
        </button>
        <button
          type="button"
          onClick={() => exec('underline')}
          title="Underline (Ctrl+U)"
          className="p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer"
        >
          <Underline size={14} />
        </button>
        <button
          type="button"
          onClick={() => exec('strikeThrough')}
          title="Strikethrough"
          className="p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer"
        >
          <Strikethrough size={14} />
        </button>

        <div className="w-px h-5 bg-[#DFE1E6] mx-1" />

        {/* Text Colors */}
        <div className="relative" ref={textColorPickerRef}>
          <button
            type="button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Text Color"
            className={`p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer flex items-center gap-0.5 ${showColorPicker ? 'bg-white border-[#DFE1E6]' : ''}`}
          >
            <Type size={14} />
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedTextColor }} />
          </button>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-2 bg-white border border-[#DFE1E6] rounded-lg shadow-2xl p-4 z-[2200] w-64 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="text-xs font-bold text-[#172B4D] mb-3">Text color</div>
              <div className="grid grid-cols-7 gap-2 mb-3">
                {textColors.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      exec('foreColor', c);
                      setSelectedTextColor(c);
                      setShowColorPicker(false);
                    }}
                    className="w-6 h-6 rounded border border-[#DFE1E6] cursor-pointer hover:scale-110 active:scale-95 transition-all flex items-center justify-center relative shrink-0"
                    style={{ backgroundColor: c }}
                    title={c}
                  >
                    {selectedTextColor === c && (
                      <Check size={12} className={c === '#FFFFFF' || c === '#FFF0B3' || c === '#FFEBE6' || c === '#DEEBFF' || c === '#E6FCFF' || c === '#E3FCEF' || c === '#EAE6FF' ? 'text-[#172B4D]' : 'text-white'} />
                    )}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  exec('foreColor', '#172B4D');
                  setSelectedTextColor('#172B4D');
                  setShowColorPicker(false);
                }}
                className="w-full text-center py-2 border border-[#DFE1E6] rounded hover:bg-[#F4F5F7] text-xs font-bold text-[#172B4D] transition-colors cursor-pointer"
              >
                Remove color
              </button>
            </div>
          )}
        </div>

        {/* Highlight Colors */}
        <div className="relative" ref={highlightColorPickerRef}>
          <button
            type="button"
            onClick={() => setShowHighlightPicker(!showHighlightPicker)}
            title="Highlight Color"
            className={`p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer flex items-center gap-0.5 ${showHighlightPicker ? 'bg-white border-[#DFE1E6]' : ''}`}
          >
            <Sparkles size={14} />
            <div className="w-2.5 h-2.5 rounded shrink-0 border border-gray-400" style={{ backgroundColor: selectedHighlightColor === 'transparent' ? '#FFFFFF' : selectedHighlightColor }} />
          </button>
          {showHighlightPicker && (
            <div className="absolute top-full left-0 mt-2 bg-white border border-[#DFE1E6] rounded-lg shadow-2xl p-4 z-[2200] w-64 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="text-xs font-bold text-[#172B4D] mb-3">Highlight color</div>
              <div className="grid grid-cols-7 gap-2 mb-3">
                {highlightColors.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      exec('hiliteColor', c);
                      setSelectedHighlightColor(c);
                      setShowHighlightPicker(false);
                    }}
                    className="w-6 h-6 rounded border border-[#DFE1E6] cursor-pointer hover:scale-110 active:scale-95 transition-all flex items-center justify-center relative shrink-0"
                    style={{ backgroundColor: c }}
                    title={c}
                  >
                    {selectedHighlightColor === c && (
                      <Check size={12} className={c === '#FFFFFF' || c === '#FFF0B3' || c === '#FFEBE6' || c === '#DEEBFF' || c === '#E6FCFF' || c === '#E3FCEF' || c === '#EAE6FF' ? 'text-[#172B4D]' : 'text-white'} />
                    )}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  exec('hiliteColor', 'transparent');
                  setSelectedHighlightColor('transparent');
                  setShowHighlightPicker(false);
                }}
                className="w-full text-center py-2 border border-[#DFE1E6] rounded hover:bg-[#F4F5F7] text-xs font-bold text-[#172B4D] transition-colors cursor-pointer"
              >
                Remove color
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-[#DFE1E6] mx-1" />

        {/* Alignment */}
        <button
          type="button"
          onClick={() => exec('justifyLeft')}
          title="Align Left"
          className="p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer"
        >
          <AlignLeft size={14} />
        </button>
        <button
          type="button"
          onClick={() => exec('justifyCenter')}
          title="Align Center"
          className="p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer"
        >
          <AlignCenter size={14} />
        </button>
        <button
          type="button"
          onClick={() => exec('justifyRight')}
          title="Align Right"
          className="p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer"
        >
          <AlignRight size={14} />
        </button>
        <button
          type="button"
          onClick={() => exec('justifyFull')}
          title="Justify"
          className="p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer"
        >
          <AlignJustify size={14} />
        </button>

        <div className="w-px h-5 bg-[#DFE1E6] mx-1" />

        {/* Lists & Checklist */}
        <button
          type="button"
          onClick={() => exec('insertUnorderedList')}
          title="Bullet List"
          className="p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer"
        >
          <List size={14} />
        </button>
        <button
          type="button"
          onClick={() => exec('insertOrderedList')}
          title="Numbered List"
          className="p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer"
        >
          <ListOrdered size={14} />
        </button>
        <button
          type="button"
          onClick={insertChecklist}
          title="Interactive Checklist"
          className="p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer"
        >
          <CheckSquare size={14} />
        </button>

        <div className="w-px h-5 bg-[#DFE1E6] mx-1" />

        {/* Inserts: Table, Link, Image, Horizontal Divider */}
        <button
          type="button"
          onClick={insertTable}
          title="Insert Table"
          className="p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer"
        >
          <TableIcon size={14} />
        </button>
        <button
          type="button"
          onClick={insertLink}
          title="Insert Link (Ctrl+K)"
          className="p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer"
        >
          <LinkIcon size={14} />
        </button>
        <button
          type="button"
          onClick={triggerFileUpload}
          title="Attach Image / File"
          className="p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer"
        >
          <Paperclip size={14} />
        </button>
        <button
          type="button"
          onClick={() => exec('insertHorizontalRule')}
          title="Horizontal Divider"
          className="p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer"
        >
          <Minus size={14} />
        </button>

        <div className="w-px h-5 bg-[#DFE1E6] mx-1" />

        {/* Code & Quote */}
        <button
          type="button"
          onClick={insertInlineCode}
          title="Inline Code"
          className="p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer"
        >
          <Code size={14} />
        </button>
        <button
          type="button"
          onClick={insertCodeBlock}
          title="Block Code Syntax"
          className="p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer font-bold text-xs"
        >
          {`{}`}
        </button>
        <button
          type="button"
          onClick={() => exec('formatBlock', 'BLOCKQUOTE')}
          title="Block Quote"
          className="p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer"
        >
          <Quote size={14} />
        </button>

        <div className="w-px h-5 bg-[#DFE1E6] mx-1" />

        {/* Emoji Selector */}
        <div className="relative" ref={emojiPickerRef}>
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Insert Emoji"
            className={`p-1.5 hover:bg-white hover:shadow-sm rounded border border-transparent hover:border-[#DFE1E6] text-[#42526E] transition-all cursor-pointer ${showEmojiPicker ? 'bg-white border-[#DFE1E6]' : ''}`}
          >
            <Smile size={14} />
          </button>
          {showEmojiPicker && (
            <div className="absolute top-full right-0 mt-2 bg-white border border-[#DFE1E6] rounded-lg shadow-2xl z-[2200] w-80 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Category tabs */}
              <div className="flex justify-between items-center border-b border-[#DFE1E6] px-2 py-1.5 bg-[#F4F5F7]/50 select-none">
                {emojiCategories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    title={cat.name}
                    onClick={() => {
                      const element = document.getElementById(`emoji-sec-${cat.id}`);
                      if (element && emojiScrollRef.current) {
                        emojiScrollRef.current.scrollTop = element.offsetTop - emojiScrollRef.current.offsetTop;
                      }
                    }}
                    className="p-1 hover:bg-[#EBECF0] rounded text-[15px] cursor-pointer transition-colors text-gray-500 hover:text-gray-900 active:scale-95 flex items-center justify-center"
                  >
                    {cat.id === 'people' ? '😊' : 
                     cat.id === 'nature' ? '🌲' : 
                     cat.id === 'food' ? '🍔' : 
                     cat.id === 'activity' ? '⚽' : 
                     cat.id === 'places' ? '🚗' : 
                     cat.id === 'objects' ? '💡' : 
                     cat.id === 'symbols' ? '❤️' : 
                     cat.id === 'flags' ? '🚩' : '☑️'}
                  </button>
                ))}
              </div>

              {/* Search bar & Add Own */}
              <div className="p-3 border-b border-[#DFE1E6] space-y-2">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-gray-400">
                    <Search size={12} />
                  </span>
                  <input
                    type="text"
                    placeholder="Search..."
                    value={emojiSearchQuery}
                    onChange={(e) => setEmojiSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#DFE1E6] rounded bg-[#FAFBFC] focus:bg-white focus:outline-none focus:border-[#4C9AFF] transition-all"
                  />
                  {emojiSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setEmojiSearchQuery('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
                
                <button
                  type="button"
                  className="w-full flex items-center gap-1.5 text-[11px] font-bold text-[#172B4D] hover:bg-[#F4F5F7] px-2 py-1.5 rounded transition-all text-left cursor-pointer border border-[#DFE1E6]"
                >
                  <span className="text-gray-400 text-sm font-light">+</span> Add your own emoji
                </button>
              </div>

              {/* Scrollable Emoji Lists */}
              <div
                ref={emojiScrollRef}
                className="max-h-60 overflow-y-auto p-3 custom-scrollbar scroll-smooth relative"
              >
                {emojiSearchQuery.trim() ? (
                  // Search results
                  <div>
                    <div className="text-[10px] font-black uppercase text-[#6B778C] tracking-wider mb-2">Search Results</div>
                    {(() => {
                      const query = emojiSearchQuery.toLowerCase().trim();
                      const matchedCategories = emojiCategories.filter(cat => cat.name.toLowerCase().includes(query) || cat.id.includes(query));
                      
                      let searchEmojis: string[] = [];
                      if (matchedCategories.length > 0) {
                        matchedCategories.forEach(cat => {
                          searchEmojis = [...searchEmojis, ...cat.emojis];
                        });
                      } else {
                        // Return first 40 general emojis that match search index
                        searchEmojis = emojiCategories[0].emojis.slice(0, 48);
                      }

                      return searchEmojis.length > 0 ? (
                        <div className="grid grid-cols-8 gap-1">
                          {searchEmojis.slice(0, 80).map((emoji, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                exec('insertText', emoji);
                                setShowEmojiPicker(false);
                                setEmojiSearchQuery('');
                              }}
                              className="p-1 hover:bg-[#F4F5F7] rounded text-[20px] cursor-pointer hover:scale-115 active:scale-95 transition-transform flex items-center justify-center h-8 w-8"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-xs text-gray-500 py-4">No emojis found</div>
                      );
                    })()}
                  </div>
                ) : (
                  // Grouped by categories
                  <div className="space-y-4">
                    {emojiCategories.map(cat => (
                      <div key={cat.id} id={`emoji-sec-${cat.id}`}>
                        <div className="text-[10px] font-black uppercase text-[#6B778C] tracking-wider mb-2 border-b border-[#F4F5F7] pb-1 select-none">{cat.name}</div>
                        <div className="grid grid-cols-8 gap-1">
                          {cat.emojis.map((emoji, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                exec('insertText', emoji);
                                setShowEmojiPicker(false);
                              }}
                              className="p-1 hover:bg-[#F4F5F7] rounded text-[20px] cursor-pointer hover:scale-115 active:scale-95 transition-transform flex items-center justify-center h-8 w-8"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Editor Content Area */}
      <div className="relative flex-1 min-h-[160px] bg-white rounded-b-md">
        <div
          ref={editorRef}
          contentEditable
          data-placeholder={placeholder}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={handleEditorClick}
          className="w-full min-h-[160px] max-h-[500px] overflow-y-auto p-4 text-[14px] font-normal leading-relaxed text-[#172B4D] outline-none prose prose-sm max-w-none custom-scrollbar custom-editor-placeholder"
        />
        <style>{`
          .custom-editor-placeholder {
            font-weight: 400 !important;
          }
          .custom-editor-placeholder:empty:before {
            content: attr(data-placeholder);
            color: #6B778C;
            cursor: text;
            font-weight: 400 !important;
          }
          .custom-editor-placeholder b, 
          .custom-editor-placeholder strong {
            font-weight: 700 !important;
          }
        `}</style>

        {/* User Mentions Popup */}
        {mentionSearch !== null && (
          <div
            className="absolute bg-white border border-[#DFE1E6] rounded-md shadow-2xl max-h-48 overflow-y-auto z-[2500] w-56 py-1 custom-scrollbar animate-in fade-in duration-100"
            style={{
              top: `${mentionCoords.top - (editorRef.current?.getBoundingClientRect().top || 0) + (editorRef.current?.scrollTop || 0)}px`,
              left: `${mentionCoords.left - (editorRef.current?.getBoundingClientRect().left || 0)}px`
            }}
          >
            <div className="px-3 py-1 text-[10px] font-black uppercase text-[#6B778C] border-b border-[#F4F5F7] tracking-wider">Mention People</div>
            {filteredUsers.map((user, i) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleMentionSelect(user)}
                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors cursor-pointer ${mentionIndex === i ? 'bg-blue-50 text-blue-700 font-bold' : 'text-[#172B4D] hover:bg-[#F4F5F7]'}`}
              >
                <div className="w-5 h-5 rounded-full bg-[#00B3A4] flex items-center justify-center text-white text-[9px] font-black">{user.name.charAt(0)}</div>
                <div className="truncate flex-1">
                  <span className="block truncate">{user.name}</span>
                  <span className="block text-[9px] font-normal text-gray-500 truncate">{user.email}</span>
                </div>
              </button>
            ))}
            {filteredUsers.length === 0 && (
              <div className="px-3 py-2 text-xs text-[#5E6C84] italic text-center">No users found</div>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        multiple
        onChange={handleFileChange}
        accept="image/*, .pdf, .doc, .docx, .xls, .xlsx, .txt, .zip"
      />

    </div>
  );
};

export default RichTextEditor;
