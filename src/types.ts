export interface Reply {
  id: string;
  authorName: string;
  authorRole: "teacher" | "student";
  content: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  authorName: string;
  authorRole: "teacher" | "student";
  content: string;
  createdAt: string;
  replies: Reply[];
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string | null;
  isOpen: boolean;
  comments: Comment[];
}

export interface Room {
  code: string;
  name: string;
  createdAt: string;
  topics: Topic[];
}

export interface HistoryItem {
  code: string;
  name: string;
  joinedAt: string;
  role: "teacher" | "student";
  userName: string;
}
