import React, { useState } from "react";
import { MessageSquare, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, ArrowLeft } from "lucide-react";
import { Room, Topic } from "../types";

interface RoomDashboardProps {
  room: Room;
  onBackToHome: () => void;
  onEnterTopic: (topicId: string) => void;
  onRefreshRoom: () => Promise<void>;
  role?: "teacher" | "student";
}

export default function RoomDashboard({ room, onBackToHome, onEnterTopic, onRefreshRoom, role = "teacher" }: RoomDashboardProps) {
  // Topic creation state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Topic editing state
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Preset templates for topic creation
  const topicPresets = [
    {
      title: "酷英閱讀測驗討論",
      description: "請分享你完成酷英閱讀測驗後, 印象最深刻的一句話，並說明原因。"
    },
    {
      title: "酷英聽力挑戰賽心得",
      description: "在這次聽力挑戰中，你學到了什麼特別的字彙或聽力技巧？"
    },
    {
      title: "每日英語造句練習",
      description: "請使用課堂上學過的『not only... but also...』句型，發揮創意造一個句子！"
    }
  ];

  // Quick preset loading
  const loadPreset = (preset: typeof topicPresets[0]) => {
    setNewTitle(preset.title);
    setNewDescription(preset.description);
  };

  // Submit adding topic (max 5 topics)
  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert("請輸入主題名稱");
      return;
    }

    if (room.topics.length >= 10) {
      alert("⚠️ 每個討論房間的主題數量已達上限（10個）！\n\n系統無法建立更多新主題。請點選進入任何歷史主題，點選其「匯出 PDF 檔案」儲存討論紀錄，並由主題列表中點擊垃圾桶按鈕刪除該主題，釋出額度後才能再次發表新主題。");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/rooms/${room.code}/topics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim()
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "新增主題失敗");
      }

      setNewTitle("");
      setNewDescription("");
      setShowAddForm(false);
      await onRefreshRoom();
    } catch (err: any) {
      alert(err.message || "發生錯誤");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save changes to topic
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTopicId) return;
    if (!editTitle.trim()) {
      alert("主題名稱不能為空");
      return;
    }

    setIsSavingEdit(true);
    try {
      const response = await fetch(`/api/rooms/${room.code}/topics/${editingTopicId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim()
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "儲存編輯失敗");
      }

      setEditingTopicId(null);
      await onRefreshRoom();
    } catch (err: any) {
      alert(err.message || "發生錯誤");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Toggle open/closed comments
  const handleToggleComments = async (topicId: string, currentOpen: boolean) => {
    try {
      const response = await fetch(`/api/rooms/${room.code}/topics/${topicId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          isOpen: !currentOpen
        })
      });

      if (!response.ok) {
        throw new Error("更新發言狀態失敗");
      }
      await onRefreshRoom();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete topic
  const handleDeleteTopic = async (topicId: string, topicTitle: string) => {
    if (!confirm(`確定要刪除討論主題「${topicTitle}」嗎？\n⚠️ 此操作刪除後將不會留下任何紀錄，且包含其中所有的留言及回覆！`)) {
      return;
    }

    try {
      const response = await fetch(`/api/rooms/${room.code}/topics/${topicId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("刪除主題失敗");
      }
      await onRefreshRoom();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Calculate total comments + replies for each topic
  const getCommentCount = (topic: Topic) => {
    return topic.comments.reduce((total, c) => total + 1 + c.replies.length, 0);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" id="dashboard_container">
      {/* Back Button and Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6" id="dashboard_header">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors cursor-pointer w-fit"
          id="btn_back_home"
        >
          <ArrowLeft className="w-4 h-4" />
          返回首頁
        </button>

        <div className="text-right">
          {role === "teacher" ? (
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2.5 py-1 font-semibold inline-block">
              教師管理中心 (僅限教師操作)
            </span>
          ) : (
            <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-2.5 py-1 font-semibold inline-block">
              討論大廳 (學生檢視中)
            </span>
          )}
        </div>
      </div>

      {/* Room Information Card */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm mb-8 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6" id="room_info_card">
        <div className="space-y-1">
          <span className="text-xs text-indigo-400 font-semibold tracking-wider uppercase block">房間名稱</span>
          <h2 className="text-2xl font-bold" id="room_name_text">{room.name}</h2>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-slate-400 text-sm">
            <span>創建日期: {new Date(room.createdAt).toLocaleDateString("zh-TW")}</span>
            <span className="w-1.5 h-1.5 bg-slate-700 rounded-full"></span>
            <span>主題數量: <strong className="text-white text-base">{room.topics.length} / 10</strong></span>
          </div>
        </div>
        
        <div className="bg-slate-800 p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center min-w-[140px] text-center">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-widest mb-1">學生加入代碼</div>
          <div className="text-3xl font-mono font-bold text-indigo-400 tracking-wider" id="room_code_text">{room.code}</div>
          <div className="text-xs text-slate-500 mt-1">分享此代碼供學生輸入</div>
        </div>
      </div>

      {/* Action and Limit Status Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-800">全部討論主題</h3>
          {role === "teacher" ? (
            <p className="text-sm text-slate-500 mt-1">
              每間房間限制最多新增 <strong className="text-indigo-600 font-bold">10</strong> 個主題。現已建立 <strong className="text-slate-950 font-bold">{room.topics.length} / 10</strong> 個。
            </p>
          ) : (
            <p className="text-sm text-slate-700 mt-1">
              請在此查看教師建立的所有討論主題，並點擊進入參與留言討論。
            </p>
          )}
        </div>

        {role === "teacher" && (
          <button
            onClick={() => {
              if (room.topics.length >= 10) {
                alert("⚠️ 每個討論房間的主題數量已達上限（10個）！\n\n系統無法建立更多新主題。請先點選進入任何歷史主題，點選其「匯出 PDF 檔案」儲存討論紀錄，並由主題列表中點擊垃圾桶按鈕刪除該主題，釋出額度後才能再次發表新主題。");
              } else {
                setShowAddForm(true);
              }
            }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-md transition-all cursor-pointer"
            id="btn_add_topic_modal"
          >
            <Plus className="w-5 h-5 text-white" />
            <span>發起新討論主題</span>
          </button>
        )}
      </div>

      {/* Add Topic Modal Form Overlay */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in" id="add_topic_overlay">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 className="font-bold text-slate-800 text-lg">發起新討論主題</h4>
              <span className="text-sm font-bold text-slate-500">目前主題數: {room.topics.length}/10</span>
            </div>

            <form onSubmit={handleAddTopic} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  討論主題名稱 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="例如: 酷英閱讀測驗討論"
                  className="w-full text-xs px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  說明與導引文字
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="例如: 請分享你完成酷英閱讀測驗後, 印象最深刻的一句話"
                  rows={3}
                  className="w-full text-xs px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Presets */}
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-100 pb-4">
                <span className="text-[11px] text-slate-500 font-bold block">推薦主題與說明範例：</span>
                <div className="space-y-2">
                  {topicPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => loadPreset(preset)}
                      className="w-full text-left bg-white hover:bg-slate-100 p-2 rounded border border-slate-200/60 text-[11px] text-slate-700 transition-colors block"
                    >
                      <div className="font-semibold text-indigo-700 mb-0.5">{preset.title}</div>
                      <div className="text-slate-500 line-clamp-1">{preset.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewTitle("");
                    setNewDescription("");
                  }}
                  className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl px-4 py-2 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl px-4 py-2 cursor-pointer disabled:opacity-50"
                >
                  確認建立
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Topic Modal Form Overlay */}
      {editingTopicId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in" id="edit_topic_overlay">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <h4 className="font-bold text-slate-800 text-lg pb-2 border-b border-slate-100">主題編輯</h4>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  討論主題名稱 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  說明與導引文字
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full text-xs px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTopicId(null)}
                  className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl px-4 py-2 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl px-4 py-2 cursor-pointer disabled:opacity-50"
                >
                  儲存修改
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List of Created Topics */}
      {room.topics.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 space-y-3 shadow-xs">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="font-semibold text-slate-800 text-base">目前尚無討論主題</h4>
          <p className="text-xs max-w-md mx-auto text-slate-400">
            尚未新增任何進行中題目。請教師點擊上方的「發起新討論主題」按鈕發起第一個題目。
          </p>
        </div>
      ) : (
        <div className="space-y-4" id="topic_list_container">
          {room.topics.map((topic) => {
            const commentCount = getCommentCount(topic);
            return (
              <div
                key={topic.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row justify-between gap-5 relative overflow-hidden"
              >
                {/* Topic info */}
                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                      topic.isOpen 
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                        : "bg-red-50 text-red-700 border border-red-100"
                    }`}>
                      {topic.isOpen ? "開放發言中" : "唯讀模式 (學生關閉發言)"}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      ID: {topic.id}
                    </span>
                  </div>

                  <h4 className="text-lg md:text-xl font-extrabold text-slate-800 leading-snug">{topic.title}</h4>
                  
                  {topic.description && (
                    <p className="text-sm md:text-base text-slate-600 leading-relaxed max-w-2xl bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                      {topic.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400 pt-1">
                    <span>創建日期: {new Date(topic.createdAt).toLocaleString("zh-TW", { hour12: false })}</span>
                    {topic.updatedAt && (
                      <span className="text-indigo-600 font-semibold">
                        最後更動: {new Date(topic.updatedAt).toLocaleString("zh-TW", { hour12: false })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Controls and statistics */}
                <div className="md:w-[220px] flex flex-col justify-between items-end border-t md:border-t-0 pt-4 md:pt-0 border-slate-100 gap-4">
                  
                  {/* Stats Badge */}
                  <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                    <span>討論留言量: <strong className="text-slate-800">{commentCount}</strong> 則</span>
                  </div>

                  {/* Actions buttons */}
                  {role === "teacher" && (
                    <div className="flex flex-wrap items-center gap-2 w-full justify-end">
                      
                      {/* Open/Close toggle */}
                      <button
                        onClick={() => handleToggleComments(topic.id, topic.isOpen)}
                        className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                          topic.isOpen
                            ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                        title={topic.isOpen ? "關閉學生發言權限" : "開放學生進行發言"}
                      >
                        {topic.isOpen ? (
                          <>
                            <ToggleRight className="w-4 h-4 text-emerald-600" />
                            <span>發言開啟中</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4 text-slate-400" />
                            <span>發言已關閉</span>
                          </>
                        )}
                      </button>

                      {/* Edit button */}
                      <button
                        onClick={() => {
                          setEditingTopicId(topic.id);
                          setEditTitle(topic.title);
                          setEditDescription(topic.description);
                        }}
                        className="p-2 text-slate-600 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer transition-colors"
                        title="編輯此主題"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={() => handleDeleteTopic(topic.id, topic.title)}
                        className="p-2 text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200 border border-red-200 rounded-lg cursor-pointer transition-colors"
                        title="刪除此主題"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                    </div>
                  )}

                  {/* Enter Topic Button */}
                  <button
                    onClick={() => onEnterTopic(topic.id)}
                    className="w-full bg-slate-900 hover:bg-indigo-600 active:bg-indigo-700 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    進入討論區
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
