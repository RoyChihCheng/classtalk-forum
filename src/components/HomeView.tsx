import React, { useState, useEffect } from "react";
import { History, PlusCircle, ArrowRight, Clipboard, Check, Users, ShieldAlert, GraduationCap, Clock, Trash2 } from "lucide-react";
import { Room, HistoryItem } from "../types";

interface HomeViewProps {
  onJoinRoom: (code: string, role: "teacher" | "student", userName: string) => void;
  historyList: HistoryItem[];
  onClearHistory: () => void;
  onRemoveHistoryItem?: (code: string, role: "teacher" | "student") => void;
}

export default function HomeView({ onJoinRoom, historyList, onClearHistory, onRemoveHistoryItem }: HomeViewProps) {
  // Common states
  const [activeTab, setActiveTab] = useState<"student" | "teacher">("student");

  // Teacher states
  const [roomName, setRoomName] = useState("");
  const [createdRoom, setCreatedRoom] = useState<Room | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [teacherName, setTeacherName] = useState("教師");

  // Student states
  const [roomCode, setRoomCode] = useState("");
  const [studentName, setStudentName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Live Time state
  const [liveTime, setLiveTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveTime(
        now.toLocaleDateString("zh-TW", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "long"
        }) + " " + now.toLocaleTimeString("zh-TW", { hour12: false })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Preset names as helpful recommendations
  const roomPresets = [
    "酷英閱讀理解課",
    "酷英七年五班英文課",
    "酷英聽力自主學習",
    "酷英單字檢定討論園地"
  ];

  // Create Room action
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) {
      alert("請輸入房間名稱！");
      return;
    }

    const teacherRoomsCount = historyList.filter(item => item.role === "teacher").length;
    if (teacherRoomsCount >= 5) {
      alert("⚠️ 教師創建與管理的房間數量已達上限（5個）！\n\n系統無法建立更多新房間。請先在右側「教師歷史紀錄」點選垃圾桶移除或清除不需再管理的歷史房間，釋出額度後才能再次建立新房間。");
      return;
    }
    
    setIsCreating(true);
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: roomName })
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "創建房間失敗");
      }
      
      const newRoom: Room = await response.json();
      setCreatedRoom(newRoom);
    } catch (err: any) {
      alert(err.message || "發生錯誤");
    } finally {
      setIsCreating(false);
    }
  };

  // Join Room action
  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!roomCode.trim()) {
      setErrorMessage("請輸入房間代碼");
      return;
    }
    if (roomCode.trim().length !== 6) {
      setErrorMessage("房間代碼必須為 6 個英數字");
      return;
    }
    if (!studentName.trim() && activeTab === "student") {
      setErrorMessage("請輸入學生姓名 / 暱稱");
      return;
    }

    const code = roomCode.trim().toUpperCase();
    setIsJoining(true);

    try {
      const response = await fetch(`/api/rooms/${code}`);
      if (!response.ok) {
        throw new Error("找不到該房間，請確認代碼是否正確");
      }
      
      const role = activeTab;
      const finalName = role === "teacher" ? teacherName.trim() || "教師" : studentName.trim();
      onJoinRoom(code, role, finalName);
    } catch (err: any) {
      setErrorMessage(err.message || "加入房間時發生錯誤");
    } finally {
      setIsJoining(false);
    }
  };

  const copyCodeToClipboard = () => {
    if (!createdRoom) return;
    navigator.clipboard.writeText(createdRoom.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" id="home_container">
      {/* Header Banner */}
      <header className="text-center mb-10 mt-4">
        <h1 className="text-4xl font-bold text-slate-800 tracking-tight flex items-center justify-center gap-2 mb-2" id="main_title">
          <GraduationCap className="w-10 h-10 text-indigo-600" />
          線上討論區
        </h1>
        <p className="text-slate-500 text-sm md:text-base">
          師生進行線上主題課堂討論、留言與互動學習的便利平台
        </p>
        <div className="mt-4 inline-flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full text-xs font-medium">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>現在時間：{liveTime || "載入中..."}</span>
        </div>
      </header>

      {/* Role Tabs */}
      <div className="flex bg-slate-100 p-1.5 rounded-xl max-w-md mx-auto mb-8 border border-slate-200" id="role_tabs">
        <button
          onClick={() => {
            setActiveTab("student");
            setErrorMessage("");
          }}
          className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
            activeTab === "student"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
          id="btn_student_tab"
        >
          <Users className="w-4 h-4" />
          我是學生 (加入討論)
        </button>
        <button
          onClick={() => {
            setActiveTab("teacher");
            setErrorMessage("");
          }}
          className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
            activeTab === "teacher"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
          id="btn_teacher_tab"
        >
          <GraduationCap className="w-4 h-4" />
          我是教師 (創建/管理)
        </button>
      </div>

      {/* Content Columns depending on Active Tab */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        
        {/* Left Side: Creation or Joining Forms */}
        <main className="md:col-span-3 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[400px] flex flex-col justify-between">
          <div>
            {activeTab === "teacher" ? (
              /* TEACHER SECTION: Create or Management */
              <div>
                {!createdRoom ? (
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2" id="teacher_section_title">
                      <PlusCircle className="w-5 h-5 text-indigo-500" />
                      創建新的討論房間
                    </h3>
                    <p className="text-xs text-slate-400 mb-6">
                      僅限教師身分創建，代碼會妥善保護以便學生加入。
                    </p>

                    <form onSubmit={handleCreateRoom} className="space-y-5">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          1. 設定房間名稱 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={roomName}
                          onChange={(e) => setRoomName(e.target.value)}
                          placeholder="例如: 酷英七年五班級英文討論"
                          className="w-full text-sm px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-800"
                          required
                          id="input_room_name"
                        />
                        
                        {/* Recommendations */}
                        <div className="mt-3">
                          <span className="text-xs text-slate-400 block mb-1.5">推薦範本 (點擊填入)：</span>
                          <div className="flex flex-wrap gap-2">
                            {roomPresets.map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setRoomName(preset)}
                                className="text-xs text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors"
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>創建日期與時間：</span>
                          <span className="font-mono text-slate-700">{new Date().toLocaleDateString("zh-TW")}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>教師顯示名稱：</span>
                          <input
                            type="text"
                            value={teacherName}
                            onChange={(e) => setTeacherName(e.target.value)}
                            placeholder="教師"
                            className="bg-transparent text-right outline-none text-slate-800 font-semibold focus:border-b focus:border-indigo-500 px-1 py-0.5"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isCreating}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        id="submit_create_room"
                      >
                        {isCreating ? "正在產生獨立編碼..." : "產生討論房間"}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                ) : (
                  /* Create Room Success Display */
                  <div className="space-y-6 text-center py-4" id="create_success_box">
                    <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner">
                      <Check className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-800">房間創建成功！</h4>
                      <p className="text-slate-500 text-xs mt-1">
                        以下是此房間專屬的獨立編碼：
                      </p>
                    </div>

                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 relative overflow-hidden">
                      <div className="text-xs text-indigo-500 font-semibold uppercase tracking-wider mb-2">房間代碼 (由6個英數字組成)</div>
                      <div className="text-3xl font-mono font-bold text-indigo-900 tracking-widest bg-white/80 py-3.5 px-6 rounded-xl inline-block border border-indigo-200/40 select-all" id="room_code_display">
                        {createdRoom.code}
                      </div>
                      
                      <div className="mt-4 flex justify-center gap-3">
                        <button
                          onClick={copyCodeToClipboard}
                          className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 hover:text-indigo-900 bg-white hover:bg-slate-50 border border-indigo-200 px-3 py-1.5 rounded-lg transition-all shadow-sm cursor-pointer"
                          id="btn_copy_code"
                        >
                          {copied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              已複製代碼
                            </>
                          ) : (
                            <>
                              <Clipboard className="w-3.5 h-3.5" />
                              複製代碼
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="text-left bg-slate-50 rounded-xl p-4 border border-slate-100 text-xs text-slate-500 space-y-1.5">
                      <div><strong className="text-slate-700">房間名稱:</strong> {createdRoom.name}</div>
                      <div><strong className="text-slate-700">創建時間:</strong> {new Date(createdRoom.createdAt).toLocaleString("zh-TW")}</div>
                      <div className="text-slate-400">請將代碼分享給學生，引導他們填寫代碼與姓名進入此房間。</div>
                    </div>

                    <button
                      onClick={() => onJoinRoom(createdRoom.code, "teacher", teacherName.trim() || "教師")}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                      id="btn_enter_management"
                    >
                      進入管理後臺
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* STUDENT SECTION: Join Room */
              <div>
                <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2" id="student_section_title">
                  <Users className="w-5 h-5 text-indigo-500" />
                  加入已創建的討論房間
                </h3>
                <p className="text-xs text-slate-400 mb-6">
                  輸入教師提供的 6 位專屬代碼與你的名字，立即參與討論。
                </p>

                <form onSubmit={handleJoinRoom} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      1. 輸入房間 6 位代碼 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                      placeholder="請輸入6位代碼, 例如: ABC95F"
                      className="w-full text-sm px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 tracking-widest font-mono text-center uppercase text-lg text-slate-800"
                      required
                      id="input_room_code"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      2. 輸入學生顯示名稱 / 暱稱 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="請輸入你的姓名 / 顯示暱稱"
                      maxLength={15}
                      className="w-full text-sm px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800"
                      required
                      id="input_student_name"
                    />
                    <span className="text-xs text-slate-400 block mt-1.5">此名稱將會顯示在你的留言及回覆旁</span>
                  </div>

                  {errorMessage && (
                    <div className="bg-red-50 text-red-600 rounded-xl p-3 text-xs border border-red-100 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isJoining}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    id="submit_join_room"
                  >
                    {isJoining ? "正在加入房間..." : "進入討論房間"}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}
          </div>
          
          <div className="pt-6 border-t border-slate-100 text-slate-400 text-center text-xs">
            線上討論區 · 教師建立主題與學生討論之平台
          </div>
        </main>

        {/* Right Side: Local Room History */}
        <aside className="md:col-span-2 bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
              <h4 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                <History className="w-5 h-5 text-indigo-500" />
                {activeTab === "teacher" ? "教師歷史紀錄" : "學生歷史紀錄"}
              </h4>
              {historyList.filter(item => item.role === activeTab).length > 0 && (
                <button
                  onClick={onClearHistory}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors font-medium border border-slate-200 bg-white hover:bg-slate-50 px-2 py-1 rounded"
                >
                  清除
                </button>
              )}
            </div>

            {historyList.filter(item => item.role === activeTab).length === 0 ? (
              <div className="bg-white border border-slate-200/60 rounded-xl p-6 text-center text-slate-400 space-y-2 py-12">
                <p className="text-sm font-semibold text-slate-500">此身分目前尚無歷史紀錄</p>
                <p className="text-xs text-slate-400 leading-normal">
                  您以【{activeTab === "teacher" ? "教師" : "學生"}】身分創建或加入的討論房間紀錄將會顯示在此。
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {historyList
                  .filter(item => item.role === activeTab)
                  .map((item, idx) => (
                    <div
                      key={`${item.code}-${idx}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => onJoinRoom(item.code, item.role, item.userName)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onJoinRoom(item.code, item.role, item.userName);
                        }
                      }}
                      className="w-full bg-white hover:bg-indigo-50/50 hover:border-indigo-200 text-left p-4 rounded-xl border border-slate-200 transition-all shadow-sm flex items-start justify-between cursor-pointer group"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="font-bold text-base text-slate-800 line-clamp-1 group-hover:text-indigo-900 transition-colors">
                          {item.name}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded font-bold">
                            {item.code}
                          </span>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                            item.role === "teacher" 
                              ? "bg-amber-50 text-amber-700 border border-amber-100" 
                              : "bg-blue-50 text-blue-700 border border-blue-100"
                          }`}>
                            {item.role === "teacher" ? "教師" : "學生"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-2">
                        <div className="text-right flex flex-col justify-between h-full min-h-[46px]">
                          <span className="text-xs text-slate-400 font-mono block">
                            {new Date(item.joinedAt).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" })}
                          </span>
                          <span className="text-sm text-slate-600 font-bold mt-1">
                            {item.userName}
                          </span>
                        </div>
                        {onRemoveHistoryItem && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`確定要將房間「${item.name}」從此瀏覽器的歷史紀錄中移除嗎？`)) {
                                onRemoveHistoryItem(item.code, item.role);
                              }
                            }}
                            className="p-1 px-1.5 border border-slate-200 bg-slate-50 hover:bg-red-50 hover:text-red-500 rounded text-slate-400 font-bold text-xs no-print shadow-xs z-10 transition-colors"
                            title="從歷史紀錄中移除本房間資訊"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="mt-6 bg-slate-100 p-4 rounded-xl text-xs text-slate-500 space-y-1.5 leading-relaxed">
            <span className="font-bold text-slate-700 block">💡 提示指引:</span>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>教師可自訂說明並得隨時關閉學生發言權限。</li>
              <li>留言及回覆字數上限皆為 <span className="font-bold text-indigo-600">100字</span>。</li>
              <li>學生與教師均可【修改與編輯】自己發出的留言。</li>
              <li>您可以隨時點擊討論區右上角的【匯出紀錄】。</li>
            </ul>
          </div>
        </aside>

      </div>
    </div>
  );
}
