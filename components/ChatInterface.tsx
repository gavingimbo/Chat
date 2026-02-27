"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    ShieldCheck,
    LayoutDashboard,
    Building2,
    ArrowUp,
    Sparkles,
    Menu,
    X,
    ChevronRight,
    ChevronDown,
    Settings,
    User,
    Plus,
    Trash2,
    FileText,
    Check,
    Loader2,
    Upload
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/lib/supabase";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface Agent {
    id: string;
    name: string;
    description: string;
    icon: any;
    active: boolean;
    instruction?: string;
}

interface KbSection {
    id: string;
    title: string;
    created_at: string;
    entry_count: number;
}

interface KbEntry {
    id: string;
    content: string;
    source: string;
    created_at: string;
}

const iconMap: Record<string, any> = {
    ShieldCheck,
    LayoutDashboard,
    Building2,
    Sparkles,
    User,
};

const defaultIcon = Sparkles;

export default function ChatInterface() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Settings / KB State
    const [showSettings, setShowSettings] = useState(false);
    const [kbSections, setKbSections] = useState<KbSection[]>([]);
    const [newKbTitle, setNewKbTitle] = useState("");
    const [agentInstruction, setAgentInstruction] = useState("");
    const [selectedAgentForSettings, setSelectedAgentForSettings] = useState<string | null>(null);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Document Upload State
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // KB Entry State
    const [isCreatingSection, setIsCreatingSection] = useState(false);
    const [isDeletingItemId, setIsDeletingItemId] = useState<string | null>(null);
    const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
    const [sectionEntries, setSectionEntries] = useState<KbEntry[]>([]);
    const [isLoadingEntries, setIsLoadingEntries] = useState(false);
    const [newEntryContent, setNewEntryContent] = useState("");
    const [newEntrySource, setNewEntrySource] = useState("");

    const activeAgent = agents.find((a) => a.id === activeAgentId) || agents[0] || { id: "privacy", name: "Privacy Advisor", icon: ShieldCheck };

    const showFeedback = (msg: string) => {
        setSavedFeedback(msg);
        setErrorMessage(null);
        setTimeout(() => setSavedFeedback(null), 3000);
    };

    const showError = (msg: string) => {
        setErrorMessage(msg);
        setSavedFeedback(null);
        setTimeout(() => setErrorMessage(null), 6000);
    };

    const fetchAgents = async () => {
        try {
            const { data, error } = await supabase
                .from("agents")
                .select("*")
                .order("created_at", { ascending: true });

            if (error) throw error;

            if (data) {
                const mappedAgents = data.map((a: any) => ({
                    id: a.slug,
                    name: a.name,
                    description: a.description,
                    icon: iconMap[a.icon] || defaultIcon,
                    active: a.active,
                    instruction: a.instruction
                }));
                setAgents(mappedAgents);
            }
        } catch (err) {
            console.error("Error fetching agents:", err);
        } finally {
            setIsInitialLoading(false);
        }
    };

    const fetchKbSections = async (agentSlug: string) => {
        try {
            const res = await fetch(`/api/kb?agentSlug=${agentSlug}`);
            const data = await res.json();
            if (res.ok) {
                setAgentInstruction(data.instruction || "");
                setKbSections(data.sections || []);
            }
        } catch (err) {
            console.error("Error fetching KB sections:", err);
        }
    };

    const fetchEntries = async (sectionId: string) => {
        setIsLoadingEntries(true);
        try {
            const res = await fetch("/api/kb", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "get_entries", sectionId }),
            });
            const data = await res.json();
            if (res.ok) {
                setSectionEntries(data.entries || []);
            }
        } catch (err) {
            console.error("Error fetching entries:", err);
        } finally {
            setIsLoadingEntries(false);
        }
    };

    useEffect(() => {
        fetchAgents();
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSelectAgent = (agentId: string) => {
        const agent = agents.find((a) => a.id === agentId);
        if (!agent) return;

        setActiveAgentId(agentId);
        setMessages([
            {
                role: "assistant",
                content: agent.id === "privacy"
                    ? "Welcome. I can help you navigate GDPR and PDPA compliance as it applies to Cinnamon Life systems and operations.\n\nFeel free to ask about guest data handling, cross-border transfers, staff records, or any scenario involving our technology stack."
                    : `Welcome to the ${agent.name} hub. How can I assist you with ${agent.description.toLowerCase()} today?`
            }
        ]);
        setMobileMenuOpen(false);
    };

    const handleAddKbSection = async () => {
        if (!newKbTitle.trim() || !selectedAgentForSettings || isCreatingSection) return;

        setIsCreatingSection(true);
        try {
            const res = await fetch("/api/kb", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "create_section",
                    agentSlug: selectedAgentForSettings,
                    title: newKbTitle,
                }),
            });

            const data = await res.json();
            if (res.ok) {
                setNewKbTitle("");
                fetchKbSections(selectedAgentForSettings);
                showFeedback("Section created");
            } else {
                showError(data.error || "Failed to create section");
            }
        } catch (err) {
            console.error("Error adding section:", err);
            showError("Network error. Please try again.");
        } finally {
            setIsCreatingSection(false);
        }
    };

    const handleDeleteSection = async (sectionId: string) => {
        if (!selectedAgentForSettings || isDeletingItemId) return;

        setIsDeletingItemId(sectionId);
        try {
            const res = await fetch("/api/kb", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "delete_section", sectionId }),
            });

            if (res.ok) {
                if (expandedSectionId === sectionId) {
                    setExpandedSectionId(null);
                    setSectionEntries([]);
                }
                fetchKbSections(selectedAgentForSettings);
                showFeedback("Section deleted");
            } else {
                const data = await res.json();
                showError(data.error || "Failed to delete section");
            }
        } catch (err) {
            console.error("Error deleting section:", err);
            showError("Network error.");
        } finally {
            setIsDeletingItemId(null);
        }
    };

    const handleAddEntry = async () => {
        if (!newEntryContent.trim() || !expandedSectionId) return;

        try {
            const res = await fetch("/api/kb", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "create_entry",
                    sectionId: expandedSectionId,
                    content: newEntryContent,
                    source: newEntrySource || "Manual Entry",
                }),
            });

            if (res.ok) {
                setNewEntryContent("");
                setNewEntrySource("");
                fetchEntries(expandedSectionId);
                if (selectedAgentForSettings) fetchKbSections(selectedAgentForSettings);
                showFeedback("Entry added");
            }
        } catch (err) {
            console.error("Error adding entry:", err);
            showFeedback("Failed to add entry");
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedAgentForSettings) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("agentSlug", selectedAgentForSettings);

        try {
            const res = await fetch("/api/kb/upload", {
                method: "POST",
                body: formData, // fetch will set the correct multipart/form-data boundary automatically
            });

            const data = await res.json();

            if (res.ok) {
                showFeedback(`Processed ${file.name} into ${data.chunksFound} chunks.`);
                fetchKbSections(selectedAgentForSettings);
            } else {
                throw new Error(data.error || "Upload failed");
            }
        } catch (err: any) {
            console.error("Error uploading document:", err);
            showFeedback(err.message || "Failed to upload document");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleDeleteEntry = async (entryId: string) => {
        if (!expandedSectionId || isDeletingItemId) return;

        setIsDeletingItemId(entryId);
        try {
            const res = await fetch("/api/kb", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "delete_entry", entryId }),
            });

            if (res.ok) {
                fetchEntries(expandedSectionId);
                if (selectedAgentForSettings) fetchKbSections(selectedAgentForSettings);
                showFeedback("Entry removed");
            } else {
                const data = await res.json();
                showError(data.error || "Failed to remove entry");
            }
        } catch (err) {
            console.error("Error deleting entry:", err);
            showError("Network error.");
        } finally {
            setIsDeletingItemId(null);
        }
    };

    const handleSaveAgentInstruction = async () => {
        if (!selectedAgentForSettings) return;
        setIsSavingSettings(true);

        try {
            const res = await fetch("/api/kb", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "update_instruction",
                    agentSlug: selectedAgentForSettings,
                    instruction: agentInstruction,
                }),
            });

            if (res.ok) {
                fetchAgents();
                showFeedback("Instructions saved");
            }
        } catch (err) {
            console.error("Error saving instruction:", err);
        } finally {
            setIsSavingSettings(false);
        }
    };

    const toggleSectionExpand = (sectionId: string) => {
        if (expandedSectionId === sectionId) {
            setExpandedSectionId(null);
            setSectionEntries([]);
        } else {
            setExpandedSectionId(sectionId);
            fetchEntries(sectionId);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { role: "user", content: input };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [...messages, userMessage],
                    agentId: activeAgentId
                }),
            });

            if (!response.ok) throw new Error("Network error");
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let accumulated = "";

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    accumulated += decoder.decode(value, { stream: true });
                    setMessages((prev) => [
                        ...prev.slice(0, -1),
                        { role: "assistant", content: accumulated },
                    ]);
                }
            }
        } catch {
            setMessages((prev) => [
                ...prev.slice(0, -1),
                { role: "assistant", content: "Something went wrong. Please try again." },
            ]);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    return (
        <div className="flex h-screen bg-zinc-50 overflow-hidden font-sans text-zinc-900 selection:bg-zinc-900 selection:text-white">
            {/* Sidebar (Desktop) */}
            <aside className="hidden md:flex w-64 flex-col bg-white border-r border-zinc-100 transition-all duration-300">
                <div className="flex flex-col h-full">
                    <div className="p-6 pb-2">
                        <button
                            onClick={() => setActiveAgentId(null)}
                            className="group flex flex-col items-start transition-all hover:translate-x-0.5"
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 shadow-[0_0_10px_rgba(0,0,0,0.1)]" />
                                <span className="text-[13px] font-bold tracking-tight text-zinc-900">Cinnamon Life</span>
                            </div>
                            <span className="text-[11px] font-medium text-zinc-400 pl-4.5">Intelligence Hub</span>
                        </button>
                    </div>

                    <div className="flex-1 px-3 py-6">
                        <div className="mb-4 px-3 flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Specialized Agents</span>
                        </div>
                        <nav className="space-y-0.5">
                            {isInitialLoading ? (
                                <div className="px-3 py-2 space-y-3">
                                    {[1, 2, 3].map(i => <div key={i} className="h-8 bg-zinc-50 rounded-lg animate-pulse" />)}
                                </div>
                            ) : (
                                agents.map((agent) => (
                                    <button
                                        key={agent.id}
                                        disabled={!agent.active && activeAgentId !== agent.id}
                                        onClick={() => handleSelectAgent(agent.id)}
                                        className={cn(
                                            "w-full flex items-center gap-2.5 px-3 py-[9px] rounded-xl text-[13px] transition-all group",
                                            activeAgentId === agent.id
                                                ? "bg-zinc-900 text-white shadow-xl shadow-zinc-200"
                                                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                                        )}
                                    >
                                        <agent.icon className={cn("w-4 h-4 transition-colors", activeAgentId === agent.id ? "text-white" : "text-zinc-400 group-hover:text-zinc-900")} />
                                        <span className="font-medium">{agent.name}</span>
                                        {!agent.active && <span className="ml-auto text-[10px] bg-zinc-50 text-zinc-400 px-1.5 py-0.5 rounded-md">Soon</span>}
                                    </button>
                                ))
                            )}
                        </nav>
                    </div>

                    <div className="p-4 border-t border-zinc-100 bg-zinc-50/50">
                        <button
                            onClick={() => setShowSettings(true)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-zinc-500 hover:text-zinc-900 hover:bg-white border border-transparent hover:border-zinc-200 transition-all"
                        >
                            <Settings className="w-4 h-4" />
                            <span>System Settings</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
                    <aside className="relative w-72 h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-500">
                        <div className="flex items-center justify-between p-6 border-b border-zinc-100">
                            <div>
                                <p className="text-[13px] font-bold tracking-tight text-zinc-900 uppercase">Intelligence</p>
                                <p className="text-[10px] text-zinc-400">Cinnamon Life Operations</p>
                            </div>
                            <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-zinc-400 hover:bg-zinc-50 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto">
                            <span className="px-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-4">Agents</span>
                            <nav className="space-y-1">
                                {agents.map((agent) => (
                                    <button
                                        key={agent.id}
                                        disabled={!agent.active && activeAgentId !== agent.id}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[14px] transition-all",
                                            activeAgentId === agent.id ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"
                                        )}
                                        onClick={() => handleSelectAgent(agent.id)}
                                    >
                                        <agent.icon className="w-4 h-4" />
                                        <span className="font-medium">{agent.name}</span>
                                    </button>
                                ))}
                            </nav>
                        </div>
                        <div className="p-4 border-t border-zinc-100">
                            <button
                                onClick={() => { setShowSettings(true); setMobileMenuOpen(false); }}
                                className="w-full flex items-center gap-3 p-4 rounded-2xl text-[14px] font-medium text-zinc-600 bg-zinc-50"
                            >
                                <Settings className="w-4 h-4" />
                                <span>Settings</span>
                            </button>
                        </div>
                    </aside>
                </div>
            )}

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 relative">
                {activeAgentId ? (
                    <>
                        {/* Toolbar */}
                        <header className="flex items-center h-14 px-4 md:px-8 border-b border-zinc-100 bg-white/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
                            <button className="md:hidden p-2 -ml-2 mr-3 text-zinc-400 hover:text-zinc-950" onClick={() => setMobileMenuOpen(true)}>
                                <Menu className="w-5 h-5" />
                            </button>
                            <div className="flex items-center gap-2 text-[13px]">
                                <button onClick={() => setActiveAgentId(null)} className="text-zinc-400 hover:text-zinc-900 transition-colors font-medium">Hub</button>
                                <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />
                                <div className="flex items-center gap-2 px-2 py-1 bg-zinc-50 rounded-lg">
                                    <activeAgent.icon className="w-3 h-3 text-zinc-900" />
                                    <span className="text-zinc-900 font-semibold tracking-tight">{activeAgent.name}</span>
                                </div>
                            </div>
                        </header>

                        {/* Messages */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-white">
                            <div className="max-w-[720px] mx-auto px-6 py-10 md:py-20 space-y-16">
                                {messages.map((message, i) => (
                                    <div key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className={cn(
                                                "w-6 h-6 rounded-lg flex items-center justify-center text-white transition-all shadow-sm",
                                                message.role === "user" ? "bg-zinc-200" : "bg-zinc-900"
                                            )}>
                                                {message.role === "assistant" ? <activeAgent.icon className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                                            </div>
                                            <span className="text-[12px] font-bold tracking-tight text-zinc-400 uppercase">
                                                {message.role === "user" ? "You" : activeAgent.name}
                                            </span>
                                        </div>

                                        <div className={cn(
                                            "pl-9 text-zinc-800",
                                            message.role === "user" && "text-zinc-500 leading-relaxed font-normal"
                                        )}>
                                            {message.role === "assistant" && message.content === "" ? (
                                                <div className="flex gap-1.5 items-center h-6">
                                                    <div className="w-1.5 h-1.5 bg-zinc-900/20 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                                    <div className="w-1.5 h-1.5 bg-zinc-900/20 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                                    <div className="w-1.5 h-1.5 bg-zinc-900/20 rounded-full animate-bounce" />
                                                </div>
                                            ) : (
                                                <div className="prose prose-zinc max-w-none prose-sm leading-relaxed tracking-tight text-[15px]">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            table: ({ children }: any) => (
                                                                <div className="overflow-x-auto my-6 rounded-xl border border-zinc-100 shadow-sm">
                                                                    <table className="min-w-full divide-y divide-zinc-100">{children}</table>
                                                                </div>
                                                            ),
                                                            thead: ({ children }: any) => <thead className="bg-zinc-50/50">{children}</thead>,
                                                            th: ({ children }: any) => <th className="px-4 py-3 text-left text-[11px] font-bold text-zinc-400 uppercase tracking-wider">{children}</th>,
                                                            td: ({ children }: any) => <td className="px-4 py-3 text-[13px] text-zinc-600 border-t border-zinc-100">{children}</td>,
                                                            h3: ({ children }: any) => <h3 className="text-[16px] font-bold text-zinc-900 mt-8 mb-3 tracking-tight">{children}</h3>,
                                                            ul: ({ children }: any) => <ul className="my-4 space-y-2 list-none">{children}</ul>,
                                                            li: ({ children }: any) => (
                                                                <li className="flex items-start gap-3 text-[14px] text-zinc-600 leading-relaxed group">
                                                                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-zinc-900/10 shrink-0 group-hover:bg-zinc-900 transition-colors" />
                                                                    <span>{children}</span>
                                                                </li>
                                                            ),
                                                            p: ({ children }: any) => <p className="text-[15px] text-zinc-600 leading-relaxed mb-5 last:mb-0">{children}</p>,
                                                            strong: ({ children }: any) => <strong className="font-bold text-zinc-950">{children}</strong>,
                                                        }}
                                                    >
                                                        {message.content}
                                                    </ReactMarkdown>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="border-t border-zinc-100 px-4 md:px-8 py-6 bg-white/80 backdrop-blur-md">
                            <form onSubmit={handleSubmit} className="max-w-[720px] mx-auto">
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-zinc-900/5 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                                    <div className="relative flex items-center gap-3 bg-zinc-50 rounded-2xl px-5 py-2 border border-zinc-200 focus-within:border-zinc-900/20 focus-within:bg-white transition-all shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                                        <Input
                                            ref={inputRef}
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            placeholder={`Ask ${activeAgent.name} anything...`}
                                            className="bg-transparent border-none focus-visible:ring-0 h-12 text-[15px] text-zinc-900 placeholder:text-zinc-400 font-medium"
                                            disabled={isLoading}
                                        />
                                        <Button
                                            type="submit"
                                            disabled={isLoading || !input.trim()}
                                            size="icon"
                                            className="w-9 h-9 rounded-xl bg-zinc-950 text-white shadow-lg shadow-zinc-200 transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
                                        >
                                            <ArrowUp className="w-4 h-4 stroke-[3px]" />
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </>
                ) : (
                    /* Home Selection View */
                    <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-8 py-12 animate-in fade-in slide-in-from-bottom-4 duration-700 bg-[#FAFAFA]/30">
                        <div className="w-full max-w-5xl space-y-16">
                            <div className="text-center space-y-5">
                                <div className="inline-flex items-center justify-center w-11 h-11 rounded-[14px] bg-zinc-900 text-white mb-6 shadow-2xl shadow-zinc-200">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <h1 className="text-3xl md:text-[40px] font-semibold text-zinc-900 tracking-[-0.03em] leading-tight">
                                    Which agent do you want to use?
                                </h1>
                                <p className="text-zinc-500 text-[15px] md:text-base max-w-[460px] mx-auto leading-relaxed">
                                    Select a specialized intelligence agent to start a secure, grounded conversation.
                                </p>
                                <div className="pt-4">
                                    <Button
                                        onClick={() => setShowSettings(true)}
                                        className="h-11 bg-white border border-zinc-200 text-zinc-900 hover:bg-zinc-50 rounded-2xl px-6 font-bold text-[13px] shadow-sm transition-all whitespace-nowrap"
                                    >
                                        <Settings className="w-4 h-4 mr-2" />
                                        Manage Intelligence
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                                {isInitialLoading ? (
                                    [1, 2, 3, 4].map(i => (
                                        <div key={i} className="h-48 bg-white border border-zinc-100 rounded-2xl animate-pulse" />
                                    ))
                                ) : (
                                    agents.map((agent) => (
                                        <button
                                            key={agent.id}
                                            onClick={() => handleSelectAgent(agent.id)}
                                            className={cn(
                                                "flex flex-col items-start p-6 rounded-2xl border text-left transition-all duration-300 relative group bg-white",
                                                agent.active
                                                    ? "border-zinc-100 hover:border-zinc-200 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-1"
                                                    : "border-zinc-50 opacity-60 grayscale-[0.5]"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-9 h-9 rounded-xl flex items-center justify-center mb-5 transition-all duration-300",
                                                agent.active ? "bg-zinc-50 text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white" : "bg-zinc-100 text-zinc-400"
                                            )}>
                                                <agent.icon className="w-[18px] h-[18px]" />
                                            </div>
                                            <h3 className="font-semibold text-zinc-900 text-[15px] mb-1.5 tracking-tight">{agent.name}</h3>
                                            <p className="text-zinc-400 text-[13px] leading-relaxed mb-6 line-clamp-2">{agent.description}</p>

                                            <div className="mt-auto flex items-center justify-between w-full pt-4 border-t border-zinc-50 overflow-hidden">
                                                <div className="flex items-center gap-1.5 text-[12px] font-medium transition-all duration-300 min-w-0">
                                                    {agent.active ? (
                                                        <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                                                            <span className="text-zinc-900 font-bold uppercase tracking-wider text-[10px]">Start chat</span>
                                                            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all text-zinc-900" />
                                                        </div>
                                                    ) : (
                                                        <span className="text-zinc-300 font-bold uppercase tracking-wider text-[10px] whitespace-nowrap">Coming soon</span>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedAgentForSettings(agent.id);
                                                        fetchKbSections(agent.id);
                                                        setShowSettings(true);
                                                    }}
                                                    className="h-7 px-2 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0"
                                                >
                                                    <Settings className="w-3 h-3 mr-1.5" />
                                                    Configure
                                                </Button>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Feedback & Error Toasts */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[70] flex flex-col gap-3">
                {savedFeedback && (
                    <div className="animate-in slide-in-from-bottom-4 fade-in duration-300">
                        <div className="flex items-center gap-2 px-5 py-3 bg-zinc-900 text-white rounded-2xl shadow-2xl text-[13px] font-semibold whitespace-nowrap">
                            <Check className="w-4 h-4 text-emerald-400" />
                            {savedFeedback}
                        </div>
                    </div>
                )}
                {errorMessage && (
                    <div className="animate-in slide-in-from-bottom-4 fade-in duration-300">
                        <div className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-2xl shadow-2xl text-[13px] font-semibold max-w-[90vw]">
                            <X className="w-4 h-4 shrink-0" />
                            <span className="leading-tight">{errorMessage}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => setShowSettings(false)} />
                    <div className="relative w-full max-w-5xl max-h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between p-8 border-b border-zinc-100 shrink-0">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Intelligence Settings</h2>
                                <p className="text-sm text-zinc-400 font-medium">Manage agents and specialized knowledge domains</p>
                            </div>
                            <button onClick={() => setShowSettings(false)} className="p-2.5 bg-zinc-50 text-zinc-400 hover:text-zinc-900 rounded-full transition-all hover:rotate-90">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-hidden flex">
                            {/* Settings Nav */}
                            <div className="w-64 border-r border-zinc-100 bg-zinc-50/50 p-6 space-y-8 shrink-0">
                                <div>
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-4">Domain Management</span>
                                    <div className="space-y-1">
                                        {agents.map(a => (
                                            <button
                                                key={a.id}
                                                onClick={() => { setSelectedAgentForSettings(a.id); fetchKbSections(a.id); setExpandedSectionId(null); setSectionEntries([]); }}
                                                className={cn(
                                                    "w-full text-left px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all",
                                                    selectedAgentForSettings === a.id ? "bg-white border border-zinc-200 text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                                                )}
                                            >
                                                {a.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Settings Content */}
                            <div className="flex-1 overflow-y-auto p-10 bg-white">
                                {selectedAgentForSettings ? (
                                    <div className="space-y-10">
                                        <div>
                                            <h3 className="text-xl font-bold text-zinc-900 mb-2">{agents.find(a => a.id === selectedAgentForSettings)?.name} Configuration</h3>
                                            <p className="text-zinc-400 text-sm">Configure agent behavior and specialized knowledge domains.</p>
                                        </div>

                                        {/* Instructions */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Base Instructions (Persona)</h4>
                                                <Button
                                                    onClick={handleSaveAgentInstruction}
                                                    disabled={isSavingSettings}
                                                    className="h-8 bg-zinc-900 text-white text-[11px] font-bold rounded-lg px-4"
                                                >
                                                    {isSavingSettings ? "Saving..." : "Save Instructions"}
                                                </Button>
                                            </div>
                                            <textarea
                                                value={agentInstruction}
                                                onChange={e => setAgentInstruction(e.target.value)}
                                                placeholder="Enter the persona and core instructions for this agent..."
                                                className="w-full min-h-[140px] p-5 rounded-2xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900/20 text-[14px] leading-relaxed transition-all resize-none outline-none"
                                            />
                                        </div>

                                        {/* KB Sections */}
                                        <div className="pt-8 border-t border-zinc-100 space-y-6">
                                            <div>
                                                <h4 className="text-[14px] font-bold text-zinc-900 mb-2">Knowledge Base Sections</h4>
                                                <p className="text-zinc-400 text-[13px]">Manage the documents and data clusters this agent can reference.</p>
                                            </div>

                                            <div className="flex gap-3">
                                                <Input
                                                    value={newKbTitle}
                                                    onChange={e => setNewKbTitle(e.target.value)}
                                                    onKeyDown={e => e.key === "Enter" && handleAddKbSection()}
                                                    placeholder="Section title (e.g. Guest Data Policy)"
                                                    className="rounded-xl border-zinc-200 h-11 py-0 focus-visible:ring-zinc-900/10 text-[14px]"
                                                />
                                                <Button
                                                    onClick={handleAddKbSection}
                                                    disabled={isCreatingSection || !newKbTitle.trim()}
                                                    className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200 h-11 rounded-xl px-6 font-bold text-[13px] shrink-0 whitespace-nowrap"
                                                >
                                                    {isCreatingSection ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
                                                    Add Section
                                                </Button>
                                            </div>

                                            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 group transition-all hover:bg-zinc-100 hover:border-zinc-300 border-dashed">
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    onChange={handleFileUpload}
                                                    accept=".pdf,.txt,.md"
                                                    disabled={isUploading}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                                />
                                                <div className="flex flex-col items-center justify-center p-8 text-center pointer-events-none">
                                                    {isUploading ? (
                                                        <>
                                                            <Loader2 className="w-8 h-8 text-zinc-400 mb-3 animate-spin" />
                                                            <p className="text-[14px] font-bold text-zinc-800">Processing Document...</p>
                                                            <p className="text-[12px] text-zinc-500 mt-1">Chunking and embedding content</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="w-12 h-12 rounded-xl bg-white border border-zinc-200 flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform">
                                                                <Upload className="w-5 h-5 text-zinc-400 group-hover:text-zinc-900 transition-colors" />
                                                            </div>
                                                            <p className="text-[14px] font-bold text-zinc-800">Upload a Document (.pdf, .txt, .md)</p>
                                                            <p className="text-[13px] text-zinc-500 mt-1">We'll automatically extract, process, and chunk the data.</p>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                {kbSections.map(section => (
                                                    <div key={section.id} className="rounded-2xl border border-zinc-100 overflow-hidden transition-all hover:border-zinc-200">
                                                        {/* Section Header */}
                                                        <div
                                                            className="p-5 bg-zinc-50 flex items-center justify-between cursor-pointer group hover:bg-white transition-all"
                                                            onClick={() => toggleSectionExpand(section.id)}
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <ChevronDown className={cn(
                                                                    "w-4 h-4 text-zinc-400 transition-transform shrink-0",
                                                                    expandedSectionId === section.id && "rotate-180"
                                                                )} />
                                                                <div className="min-w-0">
                                                                    <p className="text-[14px] font-bold text-zinc-800 tracking-tight truncate">{section.title}</p>
                                                                    <p className="text-[11px] text-zinc-400 font-medium">
                                                                        {new Date(section.created_at).toLocaleDateString()} · {section.entry_count} {section.entry_count === 1 ? "entry" : "entries"}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className="text-[11px] font-bold text-zinc-300 bg-zinc-100 px-2.5 py-1 rounded-lg">
                                                                    {section.entry_count}
                                                                </span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteSection(section.id); }}
                                                                    className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 rounded-lg h-8 w-8 p-0"
                                                                >
                                                                    {isDeletingItemId === section.id ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-300" />
                                                                    ) : (
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        {/* Expanded Entry View */}
                                                        {expandedSectionId === section.id && (
                                                            <div className="border-t border-zinc-100 bg-white p-5 space-y-5 animate-in slide-in-from-top-1 duration-200">
                                                                {/* Add Entry Form */}
                                                                <div className="space-y-3">
                                                                    <textarea
                                                                        value={newEntryContent}
                                                                        onChange={e => setNewEntryContent(e.target.value)}
                                                                        placeholder="Paste a knowledge chunk, policy excerpt, or data reference..."
                                                                        className="w-full min-h-[100px] p-4 rounded-xl bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900/20 text-[13px] leading-relaxed transition-all resize-none outline-none"
                                                                    />
                                                                    <div className="flex gap-3">
                                                                        <Input
                                                                            value={newEntrySource}
                                                                            onChange={e => setNewEntrySource(e.target.value)}
                                                                            placeholder="Source label (e.g. GDPR Article 9)"
                                                                            className="rounded-lg border-zinc-200 h-9 text-[13px]"
                                                                        />
                                                                        <Button
                                                                            onClick={handleAddEntry}
                                                                            disabled={!newEntryContent.trim()}
                                                                            className="bg-zinc-900 text-white h-9 rounded-lg px-5 text-[12px] font-bold shrink-0 whitespace-nowrap"
                                                                        >
                                                                            <Plus className="w-3.5 h-3.5 mr-1.5" />
                                                                            Add Entry
                                                                        </Button>
                                                                    </div>
                                                                </div>

                                                                {/* Entry List */}
                                                                {isLoadingEntries ? (
                                                                    <div className="space-y-3">
                                                                        {[1, 2].map(i => <div key={i} className="h-16 bg-zinc-50 rounded-xl animate-pulse" />)}
                                                                    </div>
                                                                ) : sectionEntries.length === 0 ? (
                                                                    <div className="py-8 flex flex-col items-center text-center">
                                                                        <FileText className="w-8 h-8 text-zinc-200 mb-3" />
                                                                        <p className="text-zinc-400 text-[13px] font-medium">No entries yet. Add your first knowledge chunk above.</p>
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-2">
                                                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Existing Entries</p>
                                                                        {sectionEntries.map(entry => (
                                                                            <div key={entry.id} className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 group hover:bg-white hover:border-zinc-200 transition-all">
                                                                                <div className="flex items-start justify-between gap-3">
                                                                                    <div className="min-w-0 flex-1">
                                                                                        <p className="text-[13px] text-zinc-700 leading-relaxed line-clamp-3">{entry.content}</p>
                                                                                        <p className="text-[11px] text-zinc-400 font-medium mt-2">
                                                                                            {entry.source} · {new Date(entry.created_at).toLocaleDateString()}
                                                                                        </p>
                                                                                    </div>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="sm"
                                                                                        disabled={!!isDeletingItemId}
                                                                                        onClick={() => handleDeleteEntry(entry.id)}
                                                                                        className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 rounded-lg h-7 w-7 p-0 shrink-0"
                                                                                    >
                                                                                        {isDeletingItemId === entry.id ? (
                                                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                                                        ) : (
                                                                                            <Trash2 className="w-3 h-3" />
                                                                                        )}
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                {kbSections.length === 0 && (
                                                    <div className="py-12 border-2 border-dashed border-zinc-100 rounded-3xl flex flex-col items-center justify-center bg-zinc-50/50">
                                                        <Sparkles className="w-8 h-8 text-zinc-200 mb-4" />
                                                        <p className="text-zinc-400 text-sm font-medium">No knowledge sections yet.</p>
                                                        <p className="text-zinc-300 text-[12px] mt-1">Add a section above to start building this agent&apos;s knowledge base.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                                        <div className="w-20 h-20 rounded-[28px] bg-zinc-50 flex items-center justify-center text-zinc-200 mb-4">
                                            <User className="w-10 h-10" />
                                        </div>
                                        <h3 className="text-xl font-bold text-zinc-900">Select an Agent</h3>
                                        <p className="text-zinc-400 text-sm max-w-[280px]">Select an agent from the sidebar to manage their specialized knowledge domains.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
