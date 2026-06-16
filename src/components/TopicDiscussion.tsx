import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, MessageCircle, Trash2, Edit3, Check, X, Download, RefreshCw, Search, ShieldCheck, User } from "lucide-react";
import { Room, Topic, Comment, Reply } from "../types";
import { jsPDF } from "jspdf";

interface TopicDiscussionProps {
  room: Room;
  topicId: string;
  role: "teacher" | "student";
  userName: string;
  onBack: () => void;
  onRefreshRoom: () => Promise<void>;
}

export default function TopicDiscussion({ room, topicId, role, userName, onBack, onRefreshRoom }: TopicDiscussionProps) {
  const [commentText, setCommentText] = useState("");
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({}); // Mapping commentId -> input text
  const [activeReplyBoxId, setActiveReplyBoxId] = useState<string | null>(null);
  const [replyingToTargets, setReplyingToTargets] = useState<Record<string, { targetName: string; replyId?: string } | null>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [isPollingActive, setIsPollingActive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // States for Editing/Modifying comments
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");

  // States for Editing/Modifying replies
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingReplyText, setEditingReplyText] = useState("");

  const topicIndex = room.topics.findIndex((t) => t.id === topicId);
  const topic = topicIndex !== -1 ? room.topics[topicIndex] : null;

  // Track reference for live time display
  useEffect(() => {
    setLastUpdated(new Date().toLocaleTimeString("zh-TW", { hour12: false }));
  }, [room]);

  // Active polling to synchronize discussions!
  useEffect(() => {
    let intervalId: any = null;
    if (isPollingActive) {
      intervalId = setInterval(async () => {
        try {
          await onRefreshRoom();
        } catch (err) {
          console.error("Polling sync error:", err);
        }
      }, 4000); // Poll every 4 seconds
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPollingActive]);

  if (!topic) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-4">
        <h4 className="text-xl font-bold text-slate-800">找不到該討論主題</h4>
        <p className="text-sm text-slate-500">此主題可能已被教師刪除，請返回前一頁。</p>
        <button
          onClick={onBack}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
        >
          返回
        </button>
      </div>
    );
  }

  // Helper date text
  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.toLocaleDateString("zh-TW")} ${d.toLocaleTimeString("zh-TW", { hour12: false })}`;
  };

  // Check editing authorization
  const canEditComment = (comment: Comment) => {
    if (role === "teacher") return true;
    return role === "student" && comment.authorName === userName && comment.authorRole === "student";
  };

  const canEditReply = (reply: Reply) => {
    if (role === "teacher") return true;
    return role === "student" && reply.authorName === userName && reply.authorRole === "student";
  };

  // Handle edit comment submit
  const handleEditCommentSubmit = async (commentId: string) => {
    if (!editingCommentText.trim()) return;
    if (editingCommentText.length > 100) {
      alert("內容上限 100 字！");
      return;
    }

    try {
      const response = await fetch(`/api/rooms/${room.code}/topics/${topicId}/comments/${commentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: editingCommentText.trim()
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "修改留言失敗");
      }

      setEditingCommentId(null);
      setEditingCommentText("");
      await onRefreshRoom();
    } catch (err: any) {
      alert(err.message || "發生錯誤");
    }
  };

  // Handle edit reply submit
  const handleEditReplySubmit = async (commentId: string, replyId: string) => {
    if (!editingReplyText.trim()) return;
    if (editingReplyText.length > 100) {
      alert("內容上限 100 字！");
      return;
    }

    try {
      const response = await fetch(`/api/rooms/${room.code}/topics/${topicId}/comments/${commentId}/replies/${replyId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: editingReplyText.trim()
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "修改回覆失敗");
      }

      setEditingReplyId(null);
      setEditingReplyText("");
      await onRefreshRoom();
    } catch (err: any) {
      alert(err.message || "發生錯誤");
    }
  };

  // Handle send comment (Teacher or Student)
  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    if (commentText.length > 100) {
      alert("內容上限 100 字！請縮減您的留言。");
      return;
    }

    if (!topic.isOpen && role === "student") {
      alert("此主題已關閉發言，學生無法進行留言！");
      return;
    }

    setIsSendingComment(true);
    try {
      const response = await fetch(`/api/rooms/${room.code}/topics/${topicId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          authorName: userName,
          authorRole: role,
          content: commentText.trim()
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "傳送留言失敗");
      }

      setCommentText("");
      await onRefreshRoom();
    } catch (err: any) {
      alert(err.message || "發生錯誤");
    } finally {
      setIsSendingComment(false);
    }
  };

  // Handle send reply (Teacher or Student)
  const handleSendReply = async (commentId: string) => {
    const text = replyTexts[commentId];
    if (!text || !text.trim()) return;

    if (text.length > 100) {
      alert("內容上限 100 字！請縮減您的回覆。");
      return;
    }

    if (!topic.isOpen && role === "student") {
      alert("此主題已關閉發言，學生無法進行回覆！");
      return;
    }

    const targetInfo = replyingToTargets[commentId];
    const finalContent = targetInfo ? `回覆 @${targetInfo.targetName}：${text.trim()}` : text.trim();

    if (finalContent.length > 100) {
      alert(`加上回覆對象姓名標記後（共 ${finalContent.length} 字）已超過 100 字限制！請稍微縮減您的回覆。`);
      return;
    }

    try {
      const response = await fetch(`/api/rooms/${room.code}/topics/${topicId}/comments/${commentId}/replies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          authorName: userName,
          authorRole: role,
          content: finalContent
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "傳送回覆失敗");
      }

      setReplyTexts((prev) => ({ ...prev, [commentId]: "" }));
      setReplyingToTargets((prev) => ({ ...prev, [commentId]: null }));
      setActiveReplyBoxId(null);
      await onRefreshRoom();
    } catch (err: any) {
      alert(err.message || "發生錯誤");
    }
  };

  // Delete appropriate Comment (Teacher-only)
  const handleDeleteComment = async (commentId: string) => {
    if (role !== "teacher") {
      alert("學生不具備刪除留言權限！");
      return;
    }

    if (!confirm("確定要刪除這則留言嗎？包含其下的回覆都將被同步刪除，且無法復原。")) return;

    try {
      const response = await fetch(`/api/rooms/${room.code}/topics/${topicId}/comments/${commentId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("刪除留言失敗");
      }
      await onRefreshRoom();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete appropriate Reply (Teacher-only)
  const handleDeleteReply = async (commentId: string, replyId: string) => {
    if (role !== "teacher") {
      alert("學生不具備刪除回覆權限！");
      return;
    }

    if (!confirm("確定要刪除這則回覆嗎？此操作無法撤銷。")) return;

    try {
      const response = await fetch(`/api/rooms/${room.code}/topics/${topicId}/comments/${commentId}/replies/${replyId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("刪除回覆失敗");
      }
      await onRefreshRoom();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Generate beautiful downloadable PDF document of discussions (Chinese character support included via offscreen canvas render)
  const triggerPdfExport = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    interface PdfLine {
      text: string;
      type: "title" | "subtitle" | "meta" | "comment" | "reply" | "separator" | "info" | "empty";
    }

    const lines: PdfLine[] = [
      { text: "線上課堂討論紀錄匯出報告 (PDF)", type: "title" },
      { text: `【房間名稱】: ${room.name}`, type: "meta" },
      { text: `【房間代碼】: ${room.code}`, type: "meta" },
      { text: `【匯出時間】: ${new Date().toLocaleString("zh-TW")}`, type: "meta" },
      { text: "--------------------------------------------------------", type: "separator" },
      { text: `討論主題 : ${topic.title}`, type: "subtitle" },
    ];

    if (topic.description) {
      lines.push({ text: `主題說明 : ${topic.description}`, type: "info" });
    }
    lines.push({ text: `建立時間 : ${formatTime(topic.createdAt)}`, type: "meta" });
    lines.push({ text: `發言狀態 : ${topic.isOpen ? "開放中" : "已關閉"}`, type: "meta" });
    lines.push({ text: "--------------------------------------------------------", type: "separator" });
    lines.push({ text: "", type: "empty" });

    if (topic.comments.length === 0) {
      lines.push({ text: "（目前尚無任何討論留言紀錄）", type: "comment" });
    } else {
      topic.comments.forEach((comment, cIdx) => {
        const commentRole = comment.authorRole === "teacher" ? "教師" : "學生";
        lines.push({
          text: `[留言 #${cIdx + 1}] 由 ${comment.authorName} (${commentRole}) 於 ${formatTime(comment.createdAt)} 發表：`,
          type: "meta"
        });
        lines.push({
          text: ` 「 ${comment.content} 」`,
          type: "comment"
        });

        if (comment.replies.length > 0) {
          comment.replies.forEach((reply, rIdx) => {
            const replyRole = reply.authorRole === "teacher" ? "教師" : "學生";
            lines.push({
              text: `    ┗━ [回覆 #${rIdx + 1}] ${reply.authorName} (${replyRole}) 於 ${formatTime(reply.createdAt)} 回覆：`,
              type: "meta"
            });
            lines.push({
              text: `       ➢ 「 ${reply.content} 」`,
              type: "reply"
            });
          });
        }
        lines.push({ text: "", type: "empty" });
      });
    }

    // Canvas settings
    const charWidth = 1200;
    const padding = 65;
    const lineHeight = 38;
    
    // Wrap texts beautifully on dynamic canvas size
    const wrappedLines: PdfLine[] = [];
    ctx.font = "20px 'Microsoft JhengHei', 'PingFang TC', sans-serif";

    const wrapText = (text: string, maxWidth: number) => {
      const chars = text.split("");
      let currentLine = "";
      const result: string[] = [];

      for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const testLine = currentLine + char;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth) {
          result.push(currentLine);
          currentLine = char;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        result.push(currentLine);
      }
      return result;
    };

    lines.forEach((l) => {
      let textFontSize = "21px";
      if (l.type === "title") textFontSize = "bold 34px";
      if (l.type === "subtitle") textFontSize = "bold 24px";
      ctx.font = `${textFontSize} 'Microsoft JhengHei', 'PingFang TC', sans-serif`;

      const maxW = charWidth - padding * 2;
      const wrapped = wrapText(l.text, maxW);
      wrapped.forEach((w) => {
        wrappedLines.push({ text: w, type: l.type });
      });
    });

    const linesPerPage = 36;
    const numPages = Math.ceil(wrappedLines.length / linesPerPage) || 1;

    const pdf = new jsPDF("p", "px", [800, 1130]);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    for (let page = 0; page < numPages; page++) {
      if (page > 0) pdf.addPage();

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = 1200;
      pageCanvas.height = 1697;
      const pctx = pageCanvas.getContext("2d");
      if (!pctx) continue;

      pctx.fillStyle = "#ffffff";
      pctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

      // Simple frame
      pctx.strokeStyle = "#e2e8f0";
      pctx.lineWidth = 3;
      pctx.strokeRect(40, 40, pageCanvas.width - 80, pageCanvas.height - 80);

      // Title header
      pctx.fillStyle = "#94a3b8";
      pctx.font = "14px 'Microsoft JhengHei', 'PingFang TC', sans-serif";
      pctx.fillText(`線上課堂學習紀錄  |  房間代碼: ${room.code}`, 65, 75);

      // Footer
      pctx.fillText(`第 ${page + 1} 頁 (共 ${numPages} 頁)  ·  酷英專屬討論區平台`, pageCanvas.width / 2 - 150, pageCanvas.height - 65);

      const startIndex = page * linesPerPage;
      const endIndex = Math.min(startIndex + linesPerPage, wrappedLines.length);

      let currentY = 120;
      for (let index = startIndex; index < endIndex; index++) {
        const l = wrappedLines[index];
        
        if (l.type === "title") {
          pctx.fillStyle = "#1e1b4b";
          pctx.font = "bold 34px 'Microsoft JhengHei', 'PingFang TC', sans-serif";
          currentY += 10;
        } else if (l.type === "subtitle") {
          pctx.fillStyle = "#312e81";
          pctx.font = "bold 25px 'Microsoft JhengHei', 'PingFang TC', sans-serif";
          currentY += 5;
        } else if (l.type === "separator") {
          pctx.strokeStyle = "#cbd5e1";
          pctx.lineWidth = 2;
          pctx.beginPath();
          pctx.moveTo(padding, currentY - 5);
          pctx.lineTo(pageCanvas.width - padding, currentY - 5);
          pctx.stroke();
          currentY += 15;
          continue;
        } else if (l.type === "meta") {
          pctx.fillStyle = "#4a5568";
          pctx.font = "18px 'Microsoft JhengHei', 'PingFang TC', sans-serif";
        } else if (l.type === "comment") {
          pctx.fillStyle = "#0f172a";
          pctx.font = "bold 19px 'Microsoft JhengHei', 'PingFang TC', sans-serif";
          // block background
          pctx.fillStyle = "#f1f5f9";
          pctx.fillRect(padding - 15, currentY - 25, pageCanvas.width - padding * 2 + 30, 32);
          pctx.fillStyle = "#0f172a";
        } else if (l.type === "reply") {
          pctx.fillStyle = "#475569";
          pctx.font = "18px 'Microsoft JhengHei', 'PingFang TC', sans-serif";
        } else if (l.type === "info") {
          pctx.fillStyle = "#64748b";
          pctx.font = "italic 18px 'Microsoft JhengHei', 'PingFang TC', sans-serif";
        } else {
          pctx.fillStyle = "#0f172a";
          pctx.font = "18px 'Microsoft JhengHei', 'PingFang TC', sans-serif";
        }

        pctx.fillText(l.text, padding, currentY);
        currentY += lineHeight;
      }

      const imgData = pageCanvas.toDataURL("image/jpeg", 0.95);
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
    }

    pdf.save(`${room.name}_${topic.title}_討論紀錄_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // Filter comments
  const filteredComments = topic.comments.filter((c) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const commentMatch = c.content.toLowerCase().includes(query) || c.authorName.toLowerCase().includes(query);
    const replyMatch = c.replies.some((r) => r.content.toLowerCase().includes(query) || r.authorName.toLowerCase().includes(query));
    return commentMatch || replyMatch;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-10" id="discussion_container">
      {/* Top Controls Bar - Hidden when printing */}
      <div className="flex items-center justify-between gap-4 mb-8 no-print">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-700 hover:text-indigo-600 text-base font-bold transition-colors cursor-pointer"
          id="btn_discussion_back"
        >
          <ArrowLeft className="w-5 h-5 text-indigo-500" />
          <span>返回主題列表</span>
        </button>

        <div className="flex items-center gap-3">
          {/* Polling Toggle indicator */}
          <button
            onClick={() => setIsPollingActive(!isPollingActive)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
              isPollingActive
                ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
            }`}
            title="開啟或關閉每4秒自動同步討論更新"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPollingActive ? "animate-spin" : ""}`} />
            <span>{isPollingActive ? "自動同步中" : "同步已暫停"}</span>
          </button>

          <span className="text-xs text-slate-500 font-mono hidden md:inline bg-slate-100 px-2.5 py-1 rounded">
            最後同步於: {lastUpdated}
          </span>
        </div>
      </div>

      {/* Main Print Container Wrapper */}
      <div className="p-1 md:p-0">
        
        {/* Print-Only Header Logo block */}
        <div className="hidden print:block mb-8 border-b pb-4 border-slate-300">
          <div className="text-2xl font-bold tracking-tight text-slate-800">線上交流討論區 📄</div>
          <div className="text-sm text-slate-500">彙整討論與回覆紀錄存檔</div>
        </div>

        {/* Topic Title segment block */}
        <section className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm mb-10" id="topic_presentation_block">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="space-y-1.5 flex-1">
              <span className="text-sm bg-slate-100 text-slate-700 border border-slate-200/60 px-3.5 py-1.5 rounded-md font-bold font-mono block w-fit">
                線上房間: {room.name} ({room.code})
              </span>
              <h2 className="text-3xl font-extrabold text-slate-900 mt-2 leading-snug">{topic.title}</h2>
            </div>

            {/* PDF Export button only */}
            <div className="flex items-center gap-2 no-print self-end md:self-auto">
              <button
                onClick={triggerPdfExport}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-5 py-3 rounded-xl transition-colors cursor-pointer shadow-md"
                id="btn_export_pdf"
              >
                <Download className="w-5 h-5 text-white" />
                <span>匯出 PDF 檔案</span>
              </button>
            </div>
          </div>

          {topic.description && (
            <div className="bg-indigo-50/40 p-5 rounded-xl border border-indigo-100 space-y-1.5 mb-2">
              <span className="text-sm text-indigo-600 font-bold tracking-wider uppercase block">學術引導與討論要求：</span>
              <p className="text-lg text-slate-800 leading-relaxed whitespace-pre-line font-medium">{topic.description}</p>
            </div>
          )}

          {/* User Sign-In Banner - Hidden when printing */}
          <div className="flex items-center justify-between mt-5 pt-5 border-t border-slate-100 text-base text-slate-500 no-print">
            <div className="flex items-center gap-2 font-semibold text-slate-700">
              <User className="w-5 h-5 text-slate-400" />
              <span>發言身分：<strong className="text-slate-950 font-bold">{userName}</strong></span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                role === "teacher" ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-blue-100 text-blue-800 border border-blue-200"
              }`}>
                {role === "teacher" ? "教師" : "學生"}
              </span>
            </div>

            <div className="text-slate-500 font-semibold text-xs">
              狀態：{topic.isOpen ? (
                <span className="text-emerald-600">● 討論開放中</span>
              ) : (
                <span className="text-red-500">● 已由教師關閉(唯讀)</span>
              )}
            </div>
          </div>
        </section>

        {/* Messaging Area */}
        <section className="space-y-8">
          
          {/* New Comment Submission Box */}
          {(topic.isOpen || role === "teacher") ? (
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 no-print" id="new_comment_form_box">
              <h3 className="text-sm font-bold text-slate-800 mb-3.5 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-indigo-500" />
                撰寫新留言 (限 100 字)
              </h3>
              
              <form onSubmit={handleSendComment} className="space-y-4">
                <div className="relative bg-white rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500 overflow-hidden transition-all shadow-inner">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value.slice(0, 100))}
                    placeholder="請在此處發表您的觀點或提問..."
                    rows={3}
                    className="w-full bg-transparent px-4 py-3 pb-8 text-sm text-slate-800 outline-none resize-none placeholder-slate-400 min-h-[90px]"
                    required
                  />
                  <div className="absolute bottom-2.5 right-3 flex items-center gap-2">
                    <span className={`text-xs font-bold py-0.5 px-2 rounded ${
                      commentText.length >= 100 
                        ? "bg-red-50 text-red-500" 
                        : "bg-slate-100 text-slate-500"
                    }`}>
                      {commentText.length} / 100 字
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-slate-500 leading-normal">
                    💡 請避免上傳空白內容。點擊送出即可使用「{userName} ({role === "teacher" ? "教師" : "學生"})」發表。
                  </p>
                  <button
                    type="submit"
                    disabled={isSendingComment || !commentText.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>送出留言</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-red-50/50 border border-red-200 rounded-2xl p-5 text-center text-red-600 no-print flex items-center justify-center gap-2 text-sm font-bold shadow-xs">
              <span>🔒 教師已對此主題關閉發言 (學生無法發起留言與回覆他人)</span>
            </div>
          )}

          {/* Search Box segment - Hidden when printing */}
          <div className="no-print relative">
            <Search className="absolute left-3.5 w-5 h-5 text-slate-400 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋留言關鍵字、發表者姓名..."
              className="w-full text-sm pl-11 pr-5 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 placeholder-slate-400 shadow-xs"
            />
          </div>

          {/* Comments and Thread List */}
          <div className="space-y-6" id="discussion_posts_feed">
            {filteredComments.length === 0 ? (
              <div className="border border-slate-200 p-12 bg-white rounded-2xl text-center text-slate-500 text-sm shadow-xs">
                {searchQuery.trim() ? "未篩選出符合搜尋關鍵字的留言。" : "此主題目前尚無討論留言。教師與學生仍可於上方發布。"}
              </div>
            ) : (
              filteredComments.map((comment, index) => {
                const replyingBoxOpen = activeReplyBoxId === comment.id;
                const replyText = replyTexts[comment.id] || "";
                
                return (
                  <div
                    key={comment.id}
                    className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md transition-all relative print-card"
                  >
                    
                    {/* Comment Header info */}
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-base text-slate-800">
                          {comment.authorName}
                        </span>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                          comment.authorRole === "teacher"
                            ? "bg-amber-50 text-amber-700 border-amber-100"
                            : "bg-blue-50 text-blue-700 border-blue-100"
                        }`}>
                          {comment.authorRole === "teacher" ? "教師" : "學生"}
                        </span>
                        <span className="text-sm text-slate-400 font-mono">
                          {formatTime(comment.createdAt)}
                        </span>
                      </div>

                      {/* Deletion control (Teacher-only). Hidden when printing */}
                      {role === "teacher" && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-red-500 hover:text-red-700 p-1.5 bg-red-50 hover:bg-red-100 rounded-lg border border-red-100 transition-all no-print cursor-pointer"
                          title="刪除不當留言"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Original Comment Text or Inline Edit Box */}
                    {editingCommentId === comment.id ? (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 mb-4 no-print">
                        <textarea
                          value={editingCommentText}
                          onChange={(e) => setEditingCommentText(e.target.value.slice(0, 100))}
                          className="w-full bg-white px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 resize-none h-[80px]"
                          placeholder="請輸入修改內容 (100字內)..."
                        />
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>已輸入：{editingCommentText.length} / 100 字</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setEditingCommentId(null);
                                setEditingCommentText("");
                              }}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 font-semibold text-xs"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>取消</span>
                            </button>
                            <button
                              onClick={() => handleEditCommentSubmit(comment.id)}
                              disabled={!editingCommentText.trim()}
                              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 font-semibold text-xs shadow-xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>儲存</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="group relative">
                        <p className="text-base text-slate-800 leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-slate-150 mb-3 whitespace-pre-wrap font-medium">
                          {comment.content}
                        </p>
                        {/* Edit flag / button for comment author or teacher */}
                        {canEditComment(comment) && (
                          <div className="no-print">
                            <button
                              onClick={() => {
                                setEditingCommentId(comment.id);
                                setEditingCommentText(comment.content);
                              }}
                              className="absolute right-3.5 bottom-1/2 translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-500 hover:text-indigo-700 px-2.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1 cursor-pointer text-xs font-semibold"
                              title="編輯此留言"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>編輯</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Replies Indented Segment */}
                    {comment.replies.length > 0 && (
                      <div className="ml-5 md:ml-8 mt-5 pl-5 border-l-2 border-indigo-100 space-y-4">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="relative pb-1">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-sm text-slate-800">
                                  {reply.authorName}
                                </span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                                  reply.authorRole === "teacher"
                                    ? "bg-amber-50 text-amber-700 border-amber-100"
                                    : "bg-blue-50 text-blue-700 border-blue-100"
                                }`}>
                                  {reply.authorRole === "teacher" ? "教師" : "學生"}
                                </span>
                                <span className="text-xs text-slate-400 font-mono">
                                  {formatTime(reply.createdAt)}
                                </span>
                              </div>

                              {/* Deletion control for reply (Teacher-only). Hidden when printing */}
                              {role === "teacher" && (
                                <button
                                  onClick={() => handleDeleteReply(comment.id, reply.id)}
                                  className="text-red-500 hover:text-red-700 p-1.5 bg-red-50 hover:bg-red-100 rounded-lg border border-red-100 transition-all no-print cursor-pointer"
                                  title="刪除不當回覆"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            
                            {/* Reply content text or Inline Edit Box */}
                            {editingReplyId === reply.id ? (
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5 mt-1.5 no-print">
                                <input
                                  type="text"
                                  value={editingReplyText}
                                  onChange={(e) => setEditingReplyText(e.target.value.slice(0, 100))}
                                  className="w-full bg-white px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                                  placeholder="請修改回覆內容 (100字內)..."
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && editingReplyText.trim()) {
                                      handleEditReplySubmit(comment.id, reply.id);
                                    }
                                  }}
                                />
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                  <span>{editingReplyText.length} / 100 字</span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => {
                                        setEditingReplyId(null);
                                        setEditingReplyText("");
                                      }}
                                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-lg cursor-pointer text-xs font-semibold"
                                    >
                                      取消
                                    </button>
                                    <button
                                      onClick={() => handleEditReplySubmit(comment.id, reply.id)}
                                      disabled={!editingReplyText.trim()}
                                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3.5 py-1.5 rounded-lg cursor-pointer text-xs font-bold"
                                    >
                                      儲存
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-[15px] md:text-base text-slate-800 bg-slate-50/40 p-3.5 md:p-4 rounded-xl border border-slate-100 whitespace-pre-wrap leading-relaxed font-semibold">
                                  {reply.content}
                                </p>
                                
                                {/* Inline Actions footer for subreply */}
                                <div className="flex items-center gap-4 no-print text-xs pl-1">
                                  {(topic.isOpen || role === "teacher") && (
                                    <button
                                      onClick={() => {
                                        setActiveReplyBoxId(comment.id);
                                        setReplyingToTargets((prev) => ({
                                          ...prev,
                                          [comment.id]: { targetName: reply.authorName, replyId: reply.id }
                                        }));
                                        if (replyTexts[comment.id] === undefined) {
                                          setReplyTexts((p) => ({ ...p, [comment.id]: "" }));
                                        }
                                      }}
                                      className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer flex items-center gap-1 text-[13px] transition-all py-1 px-1.5 rounded bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100/40"
                                      title="回覆此言論"
                                    >
                                      <MessageCircle className="w-3.5 h-3.5 text-indigo-500" />
                                      <span>回覆</span>
                                    </button>
                                  )}

                                  {canEditReply(reply) && (
                                    <button
                                      onClick={() => {
                                        setEditingReplyId(reply.id);
                                        setEditingReplyText(reply.content);
                                      }}
                                      className="text-slate-500 hover:text-indigo-600 font-semibold hover:underline cursor-pointer flex items-center gap-1 text-[13px] transition-colors py-1"
                                      title="修改此段言論"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                      <span>編輯</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                          </div>
                        ))}
                      </div>
                    )}

                    {/* Inline Reply triggers */}
                    {(topic.isOpen || role === "teacher") && (
                      <div className="mt-4 text-right no-print">
                        {!replyingBoxOpen ? (
                          <button
                            onClick={() => {
                              setActiveReplyBoxId(comment.id);
                              setReplyingToTargets((prev) => ({ ...prev, [comment.id]: null }));
                              if (replyTexts[comment.id] === undefined) {
                                setReplyTexts((p) => ({ ...p, [comment.id]: "" }));
                              }
                            }}
                            className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1.5 cursor-pointer font-extrabold"
                          >
                            <MessageCircle className="w-4 h-4 text-indigo-600" />
                            <span>回覆貼文</span>
                          </button>
                        ) : (
                          <div className="mt-3 bg-indigo-50/10 p-4 rounded-xl border border-indigo-100 text-left">
                            {/* Replying target header indicator badge */}
                            {replyingToTargets[comment.id] ? (
                              <div className="flex items-center gap-2 mb-2 text-xs md:text-sm text-indigo-700 font-extrabold bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 px-3 py-1.5 rounded-lg w-fit transition-colors">
                                <span className="flex items-center gap-1">
                                  <User className="w-3.5 h-3.5 text-indigo-500" />
                                  正在針對 @{replyingToTargets[comment.id]?.targetName} 的留言進行回覆
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setReplyingToTargets((prev) => ({ ...prev, [comment.id]: null }))}
                                  className="hover:bg-indigo-200 p-0.5 rounded text-indigo-500 transition-colors cursor-pointer ml-1"
                                  title="取消針對此回覆，改為一般回覆"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1">
                                <MessageCircle className="w-4 h-4 text-slate-400" />
                                <span>撰寫對本篇貼文的回覆：</span>
                              </div>
                            )}

                            <div className="relative bg-white rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                              <input
                                type="text"
                                maxLength={100}
                                value={replyText}
                                onChange={(e) => setReplyTexts((prev) => ({ ...prev, [comment.id]: e.target.value.slice(0, 100) }))}
                                placeholder={replyingToTargets[comment.id] ? `請輸入針對 @${replyingToTargets[comment.id]?.targetName} 的回覆內容 (100字內)...` : "請輸入回覆探討內容 (100字內)..."}
                                className="w-full bg-transparent px-3.5 py-3 text-sm text-slate-800 outline-none placeholder-slate-400 font-medium"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && replyText.trim()) {
                                    handleSendReply(comment.id);
                                  }
                                }}
                              />
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                                {replyText.length} / 100 字
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-end gap-2 mt-3">
                              <button
                                onClick={() => {
                                  setActiveReplyBoxId(null);
                                }}
                                className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-3.5 py-2 rounded-lg transition-colors cursor-pointer font-bold"
                              >
                                取消
                              </button>
                              <button
                                onClick={() => handleSendReply(comment.id)}
                                disabled={!replyText.trim()}
                                className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-45 text-white px-4 py-2 rounded-lg transition-colors font-bold cursor-pointer shadow-xs"
                              >
                                送出回覆
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>

        </section>

      </div>
    </div>
  );
}
