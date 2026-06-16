import React, { useState, useEffect } from "react";
import HomeView from "./components/HomeView";
import RoomDashboard from "./components/RoomDashboard";
import TopicDiscussion from "./components/TopicDiscussion";
import { Room, HistoryItem } from "./types";
import { MessageSquare, ArrowLeft, RefreshCw } from "lucide-react";

export default function App() {
  const [currentView, setCurrentView] = useState<"home" | "dashboard" | "discussion">("home");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"teacher" | "student" | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("discussion_forum_history");
      if (stored) {
        setHistoryList(JSON.parse(stored));
      }
    } catch (err) {
      console.error("Failed to parse local history:", err);
    }
  }, []);

  // Sync active room changes on demands (for polling and state updates)
  const refreshRoom = async () => {
    if (!roomCode) return;
    try {
      const response = await fetch(`/api/rooms/${roomCode}`);
      if (response.ok) {
        const data = await response.json();
        setRoom(data);
      }
    } catch (err) {
      console.error("Refresh room failed:", err);
    }
  };

  // Join Room action
  const handleJoinOrCreateRoom = async (code: string, role: "teacher" | "student", uName: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/rooms/${code}`);
      if (!response.ok) {
        throw new Error("房間載入失敗");
      }

      const roomData: Room = await response.json();
      setRoom(roomData);
      setRoomCode(code);
      setUserRole(role);
      setUserName(uName || (role === "teacher" ? "教師" : "學生"));
      setCurrentView("dashboard");

      // Update local storage history
      const item: HistoryItem = {
        code,
        name: roomData.name,
        joinedAt: new Date().toISOString(),
        role,
        userName: uName || (role === "teacher" ? "教師" : "學生")
      };

      setHistoryList((prev) => {
        // Filter out existing duplicates with same code and role
        const filtered = prev.filter((h) => !(h.code === code && h.role === role));
        const updated = [item, ...filtered]; // Keep all user history records, system does not delete automatically
        localStorage.setItem("discussion_forum_history", JSON.stringify(updated));
        return updated;
      });
    } catch (err: any) {
      alert(err.message || "載入房間失敗，請再試一次");
    } finally {
      setIsLoading(false);
    }
  };

  // Remove single history item
  const handleRemoveHistoryItem = (code: string, role: "teacher" | "student") => {
    setHistoryList((prev) => {
      const updated = prev.filter((h) => !(h.code === code && h.role === role));
      localStorage.setItem("discussion_forum_history", JSON.stringify(updated));
      return updated;
    });
  };

  // Clear local history
  const handleClearHistory = () => {
    if (confirm("確定要清除所有造訪紀錄嗎？")) {
      localStorage.removeItem("discussion_forum_history");
      setHistoryList([]);
    }
  };

  // Topic Selection Entry
  const handleEnterTopic = (topicId: string) => {
    setActiveTopicId(topicId);
    setCurrentView("discussion");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans flex flex-col justify-between">
      
      {/* Dynamic Main Body Content */}
      <div className="flex-1 pb-16">
        
        {/* Loader overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
              <span className="text-xs font-semibold text-slate-600">正在連接討論房間...</span>
            </div>
          </div>
        )}

        {/* Home page */}
        {currentView === "home" && (
          <HomeView
            onJoinRoom={handleJoinOrCreateRoom}
            historyList={historyList}
            onClearHistory={handleClearHistory}
            onRemoveHistoryItem={handleRemoveHistoryItem}
          />
        )}

        {/* Dashboard page (Topic summary list) */}
        {currentView === "dashboard" && room && (
          <RoomDashboard
            room={room}
            role={userRole || "student"}
            onBackToHome={() => {
              setCurrentView("home");
              setRoomCode(null);
              setRoom(null);
            }}
            onEnterTopic={handleEnterTopic}
            onRefreshRoom={refreshRoom}
          />
        )}

        {/* Discussion inside specific topic page */}
        {currentView === "discussion" && room && activeTopicId && (
          <TopicDiscussion
            room={room}
            topicId={activeTopicId}
            role={userRole || "student"}
            userName={userName}
            onBack={() => {
              setCurrentView("dashboard");
              setActiveTopicId(null);
              refreshRoom();
            }}
            onRefreshRoom={refreshRoom}
          />
        )}
      </div>

      {/* Humble Footer Design - Hidden during print */}
      <footer className="text-center py-6 border-t border-slate-200/60 text-xs text-slate-400 no-print bg-white select-none">
        <div className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <div>線上討論區 · 專屬課堂互動平台</div>
          <div className="flex items-center gap-4">
            <span>支援無痕與行動裝置觀看</span>
            <span className="text-slate-300">|</span>
            <span className="font-mono">v1.1.2</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
