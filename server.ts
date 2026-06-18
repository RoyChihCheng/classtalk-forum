import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";

interface Reply {
  id: string;
  authorName: string;
  authorRole: "teacher" | "student";
  content: string;
  createdAt: string;
}

interface Comment {
  id: string;
  authorName: string;
  authorRole: "teacher" | "student";
  content: string;
  createdAt: string;
  replies: Reply[];
}

interface Topic {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string | null;
  isOpen: boolean;
  comments: Comment[];
}

interface Room {
  code: string;
  name: string;
  createdAt: string;
  topics: Topic[];
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function sortByCreatedAt(arr: any[]): any[] {
  return arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

function transformRoom(raw: any): Room {
  return {
    code: raw.code,
    name: raw.name,
    createdAt: raw.created_at,
    topics: sortByCreatedAt(raw.topics || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description || "",
      isOpen: t.is_open,
      createdAt: t.created_at,
      updatedAt: t.updated_at ?? null,
      comments: sortByCreatedAt(t.comments || []).map((c: any) => ({
        id: c.id,
        authorName: c.author_name,
        authorRole: c.author_role,
        content: c.content,
        createdAt: c.created_at,
        replies: sortByCreatedAt(c.replies || []).map((r: any) => ({
          id: r.id,
          authorName: r.author_name,
          authorRole: r.author_role,
          content: r.content,
          createdAt: r.created_at,
        })),
      })),
    })),
  };
}

async function fetchRoom(code: string): Promise<Room | null> {
  const { data, error } = await supabase
    .from("rooms")
    .select(`
      code, name, created_at,
      topics (
        id, title, description, is_open, created_at, updated_at,
        comments (
          id, author_name, author_role, content, created_at,
          replies (
            id, author_name, author_role, content, created_at
          )
        )
      )
    `)
    .eq("code", code)
    .single();

  if (error || !data) return null;
  return transformRoom(data);
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "8080");

  app.use(express.json());

  // GET /auth/callback — 酷英 SSO 跳轉入口
  app.get("/auth/callback", (req, res) => {
    const { p, q } = req.query;

    // 1. 檢查參數存在
    if (!p || !q || typeof p !== "string" || typeof q !== "string") {
      return res.status(400).send("缺少必要參數，請重新從酷英登入");
    }

    // 2. 驗證簽章
    const secret = process.env.COOLENG_SSO_SECRET!;
    const expectedQ = crypto.createHash("sha256").update(p + secret).digest("hex");
    if (expectedQ !== q) {
      return res.status(403).send("驗證失敗，請重新從酷英登入");
    }

    // 3. 解碼 p（hex → 文字）
    let decoded: string;
    try {
      decoded = Buffer.from(p, "hex").toString("utf8");
    } catch {
      return res.status(400).send("資料格式錯誤");
    }

    // 4. 切開欄位：userid|姓名|role|timestamp|cool
    const parts = decoded.split("|");
    if (parts.length < 5) {
      return res.status(400).send("資料格式錯誤");
    }
    const [userid, name, role, timestamp] = parts;

    // 5. 驗證時間戳（5 分鐘內有效）
    const ts = parseInt(timestamp);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > 300) {
      return res.status(403).send("連結已過期，請重新從酷英登入");
    }

    // 6. 驗證 role 格式
    if (role !== "teacher" && role !== "student") {
      return res.status(400).send("無效的身分");
    }

    // 7. 跳轉到前端，帶上 userid、姓名和身分（uid 用來做 localStorage key，不受名稱格式影響）
    const redirectUrl = `/?sso_uid=${encodeURIComponent(userid)}&sso_name=${encodeURIComponent(name)}&sso_role=${encodeURIComponent(role)}`;
    res.redirect(redirectUrl);
  });

  // GET /api/rooms/:code
  app.get("/api/rooms/:code", async (req, res) => {
    const code = req.params.code.toUpperCase();
    const room = await fetchRoom(code);
    if (room) {
      res.json(room);
    } else {
      res.status(404).json({ error: "找不到該房間，請確認代碼是否正確" });
    }
  });

  // POST /api/rooms
  app.post("/api/rooms", async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "房間名稱不能為空" });
    }

    let code = "";
    for (let i = 0; i < 10; i++) {
      const candidate = generateRoomCode();
      const { data } = await supabase.from("rooms").select("code").eq("code", candidate).maybeSingle();
      if (!data) { code = candidate; break; }
    }
    if (!code) return res.status(500).json({ error: "無法產生唯一房間代碼，請再試一次" });

    const { data: newRoom, error } = await supabase
      .from("rooms")
      .insert({ code, name: name.trim() })
      .select()
      .single();

    if (error || !newRoom) return res.status(500).json({ error: "建立房間失敗" });

    res.status(201).json({ code: newRoom.code, name: newRoom.name, createdAt: newRoom.created_at, topics: [] });
  });

  // POST /api/rooms/:code/topics
  app.post("/api/rooms/:code/topics", async (req, res) => {
    const code = req.params.code.toUpperCase();
    const { title, description } = req.body;

    if (!title || typeof title !== "string" || title.trim() === "") {
      return res.status(400).json({ error: "討論主題標題不能為空" });
    }

    const { data: room } = await supabase.from("rooms").select("code").eq("code", code).maybeSingle();
    if (!room) return res.status(404).json({ error: "未找到該房間" });

    const { count } = await supabase.from("topics").select("*", { count: "exact", head: true }).eq("room_code", code);
    if ((count ?? 0) >= 10) return res.status(400).json({ error: "每間房間最多只能新增 10 個討論主題" });

    const id = Math.random().toString(36).substring(2, 9);
    const { data: newTopic, error } = await supabase
      .from("topics")
      .insert({ id, room_code: code, title: title.trim(), description: (description || "").trim(), is_open: true })
      .select()
      .single();

    if (error || !newTopic) return res.status(500).json({ error: "建立主題失敗" });

    res.status(201).json({
      id: newTopic.id,
      title: newTopic.title,
      description: newTopic.description,
      isOpen: newTopic.is_open,
      createdAt: newTopic.created_at,
      updatedAt: null,
      comments: []
    });
  });

  // PUT /api/rooms/:code/topics/:topicId
  app.put("/api/rooms/:code/topics/:topicId", async (req, res) => {
    const code = req.params.code.toUpperCase();
    const topicId = req.params.topicId;
    const { title, description, isOpen } = req.body;

    const { data: topic } = await supabase.from("topics").select("*").eq("id", topicId).eq("room_code", code).maybeSingle();
    if (!topic) return res.status(404).json({ error: "未找到該主題" });

    const updates: any = { updated_at: new Date().toISOString() };
    if (title !== undefined) {
      if (typeof title !== "string" || title.trim() === "") return res.status(400).json({ error: "討論主題標題不能為空" });
      updates.title = title.trim();
    }
    if (description !== undefined) updates.description = description.trim();
    if (isOpen !== undefined) updates.is_open = !!isOpen;

    const { data: updated, error } = await supabase.from("topics").update(updates).eq("id", topicId).select().single();
    if (error || !updated) return res.status(500).json({ error: "更新主題失敗" });

    res.json({ id: updated.id, title: updated.title, description: updated.description, isOpen: updated.is_open, createdAt: updated.created_at, updatedAt: updated.updated_at, comments: [] });
  });

  // DELETE /api/rooms/:code/topics/:topicId
  app.delete("/api/rooms/:code/topics/:topicId", async (req, res) => {
    const code = req.params.code.toUpperCase();
    const topicId = req.params.topicId;

    const { data: topic } = await supabase.from("topics").select("id").eq("id", topicId).eq("room_code", code).maybeSingle();
    if (!topic) return res.status(404).json({ error: "未找到該主題" });

    const { error } = await supabase.from("topics").delete().eq("id", topicId);
    if (error) return res.status(500).json({ error: "刪除主題失敗" });

    res.json({ message: "主題已成功刪除" });
  });

  // POST /api/rooms/:code/topics/:topicId/comments
  app.post("/api/rooms/:code/topics/:topicId/comments", async (req, res) => {
    const code = req.params.code.toUpperCase();
    const topicId = req.params.topicId;
    const { authorName, authorRole, content } = req.body;

    if (!authorName || typeof authorName !== "string" || authorName.trim() === "") return res.status(400).json({ error: "發言者名稱不能為空" });
    if (authorRole !== "teacher" && authorRole !== "student") return res.status(400).json({ error: "無效的角色標籤" });
    if (!content || typeof content !== "string" || content.trim() === "") return res.status(400).json({ error: "留言內容不能為空" });
    if (content.length > 100) return res.status(400).json({ error: "留言內容限制在 100 字以內" });

    const { data: topic } = await supabase.from("topics").select("id, is_open, room_code").eq("id", topicId).maybeSingle();
    if (!topic || topic.room_code !== code) return res.status(404).json({ error: "未找到該主題" });
    if (!topic.is_open && authorRole === "student") return res.status(403).json({ error: "此主題已關閉發言，學生無法進行留言" });

    const id = "c_" + Math.random().toString(36).substring(2, 9);
    const { data: newComment, error } = await supabase
      .from("comments")
      .insert({ id, topic_id: topicId, author_name: authorName.trim(), author_role: authorRole, content: content.trim() })
      .select()
      .single();

    if (error || !newComment) return res.status(500).json({ error: "發表留言失敗" });

    res.status(201).json({ id: newComment.id, authorName: newComment.author_name, authorRole: newComment.author_role, content: newComment.content, createdAt: newComment.created_at, replies: [] });
  });

  // PUT /api/rooms/:code/topics/:topicId/comments/:commentId
  app.put("/api/rooms/:code/topics/:topicId/comments/:commentId", async (req, res) => {
    const commentId = req.params.commentId;
    const { content } = req.body;

    if (!content || typeof content !== "string" || content.trim() === "") return res.status(400).json({ error: "留言內容不能為空" });
    if (content.length > 100) return res.status(400).json({ error: "留言內容限制在 100 字以內" });

    const { data: comment } = await supabase.from("comments").select("id").eq("id", commentId).maybeSingle();
    if (!comment) return res.status(404).json({ error: "未找到該留言" });

    const { data: updated, error } = await supabase.from("comments").update({ content: content.trim() }).eq("id", commentId).select().single();
    if (error || !updated) return res.status(500).json({ error: "編輯留言失敗" });

    res.json({ id: updated.id, authorName: updated.author_name, authorRole: updated.author_role, content: updated.content, createdAt: updated.created_at, replies: [] });
  });

  // DELETE /api/rooms/:code/topics/:topicId/comments/:commentId
  app.delete("/api/rooms/:code/topics/:topicId/comments/:commentId", async (req, res) => {
    const commentId = req.params.commentId;

    const { data: comment } = await supabase.from("comments").select("id").eq("id", commentId).maybeSingle();
    if (!comment) return res.status(404).json({ error: "未找到該留言" });

    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) return res.status(500).json({ error: "刪除留言失敗" });

    res.json({ message: "留言已成功刪除" });
  });

  // POST /api/rooms/:code/topics/:topicId/comments/:commentId/replies
  app.post("/api/rooms/:code/topics/:topicId/comments/:commentId/replies", async (req, res) => {
    const topicId = req.params.topicId;
    const commentId = req.params.commentId;
    const { authorName, authorRole, content } = req.body;

    if (!authorName || typeof authorName !== "string" || authorName.trim() === "") return res.status(400).json({ error: "發言者名稱不能為空" });
    if (authorRole !== "teacher" && authorRole !== "student") return res.status(400).json({ error: "無效的角色標籤" });
    if (!content || typeof content !== "string" || content.trim() === "") return res.status(400).json({ error: "回覆內容不能為空" });
    if (content.length > 100) return res.status(400).json({ error: "回覆內容限制在 100 字以內" });

    const { data: topic } = await supabase.from("topics").select("is_open").eq("id", topicId).maybeSingle();
    if (!topic) return res.status(404).json({ error: "未找到該主題" });
    if (!topic.is_open && authorRole === "student") return res.status(403).json({ error: "此主題已關閉發言，學生無法進行回覆" });

    const { data: comment } = await supabase.from("comments").select("id").eq("id", commentId).maybeSingle();
    if (!comment) return res.status(404).json({ error: "未找到該留言" });

    const id = "r_" + Math.random().toString(36).substring(2, 9);
    const { data: newReply, error } = await supabase
      .from("replies")
      .insert({ id, comment_id: commentId, author_name: authorName.trim(), author_role: authorRole, content: content.trim() })
      .select()
      .single();

    if (error || !newReply) return res.status(500).json({ error: "發表回覆失敗" });

    res.status(201).json({ id: newReply.id, authorName: newReply.author_name, authorRole: newReply.author_role, content: newReply.content, createdAt: newReply.created_at });
  });

  // PUT /api/rooms/:code/topics/:topicId/comments/:commentId/replies/:replyId
  app.put("/api/rooms/:code/topics/:topicId/comments/:commentId/replies/:replyId", async (req, res) => {
    const replyId = req.params.replyId;
    const { content } = req.body;

    if (!content || typeof content !== "string" || content.trim() === "") return res.status(400).json({ error: "回覆內容不能為空" });
    if (content.length > 100) return res.status(400).json({ error: "回覆內容限制在 100 字以內" });

    const { data: reply } = await supabase.from("replies").select("id").eq("id", replyId).maybeSingle();
    if (!reply) return res.status(404).json({ error: "未找到該回覆" });

    const { data: updated, error } = await supabase.from("replies").update({ content: content.trim() }).eq("id", replyId).select().single();
    if (error || !updated) return res.status(500).json({ error: "編輯回覆失敗" });

    res.json({ id: updated.id, authorName: updated.author_name, authorRole: updated.author_role, content: updated.content, createdAt: updated.created_at });
  });

  // DELETE /api/rooms/:code/topics/:topicId/comments/:commentId/replies/:replyId
  app.delete("/api/rooms/:code/topics/:topicId/comments/:commentId/replies/:replyId", async (req, res) => {
    const replyId = req.params.replyId;

    const { data: reply } = await supabase.from("replies").select("id").eq("id", replyId).maybeSingle();
    if (!reply) return res.status(404).json({ error: "未找到該回覆" });

    const { error } = await supabase.from("replies").delete().eq("id", replyId);
    if (error) return res.status(500).json({ error: "刪除回覆失敗" });

    res.json({ message: "回覆已成功刪除" });
  });

  // Vite / static serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
