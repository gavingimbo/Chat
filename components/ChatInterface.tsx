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
    Settings,
    User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
}

const agents: Agent[] = [
    { id: "privacy", name: "Privacy Advisor", description: "GDPR & PDPA guidance", icon: ShieldCheck, active: true },
    { id: "it", name: "Simphony", description: "Systems & infra", icon: LayoutDashboard, active: false },
    { id: "ops", name: "IT Operations", description: "LOB management", icon: Building2, active: false },
    { id: "legal", name: "Legal Advisor", description: "Contracts & policies", icon: ShieldCheck, active: false },
];

export default function ChatInterface() {
    const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const activeAgent = agents.find((a) => a.id === activeAgentId) || agents[0];

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSelectAgent = (agentId: string) => {
        const agent = agents.find((a) => a.id === agentId);
        if (!agent || !agent.active) return;

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
        <div className="flex h-screen w-full bg-white text-zinc-900 antialiased">
            {/* ─── Sidebar ─── */}
            <aside className="hidden md:flex w-60 flex-col border-r border-zinc-100 bg-[#FAFAFA]">
                <button
                    onClick={() => setActiveAgentId(null)}
                    className="px-5 pt-6 pb-4 text-left hover:opacity-80 transition-opacity"
                >
                    <p className="text-[13px] font-semibold text-zinc-900 tracking-tight">Cinnamon Life</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">Intelligence Hub</p>
                </button>

                <div className="px-3 flex-1">
                    <p className="px-2 text-[10px] font-medium text-zinc-400 mb-2">Agents</p>
                    <nav className="space-y-0.5">
                        {agents.map((agent) => (
                            <button
                                key={agent.id}
                                disabled={!agent.active}
                                onClick={() => handleSelectAgent(agent.id)}
                                className={cn(
                                    "w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px] transition-all",
                                    agent.active
                                        ? activeAgentId === agent.id
                                            ? "bg-white text-zinc-900 font-medium border border-zinc-150 shadow-sm"
                                            : "text-zinc-500 hover:bg-zinc-100/50"
                                        : "text-zinc-400 opacity-50 cursor-not-allowed"
                                )}
                            >
                                <agent.icon className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{agent.name}</span>
                                {!agent.active && <span className="ml-auto text-[9px] text-zinc-400 font-medium">Soon</span>}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="px-3 pb-4 border-t border-zinc-100 pt-3">
                    <button className="w-full flex items-center gap-2.5 px-2.5 py-[7px] text-zinc-400 hover:text-zinc-700 text-[13px] transition-colors">
                        <Settings className="w-3.5 h-3.5" />
                        <span>Settings</span>
                    </button>
                </div>
            </aside>

            {/* ─── Mobile Overlay ─── */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div className="absolute inset-0 bg-black/20" onClick={() => setMobileMenuOpen(false)} />
                    <aside className="relative w-64 h-full bg-white border-r border-zinc-100 flex flex-col">
                        <div className="flex items-center justify-between px-5 pt-5 pb-3">
                            <button onClick={() => { setActiveAgentId(null); setMobileMenuOpen(false); }}>
                                <p className="text-[13px] font-semibold text-zinc-900">Cinnamon Life</p>
                                <p className="text-[11px] text-zinc-400 mt-0.5">Intelligence Hub</p>
                            </button>
                            <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-zinc-400">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="px-3 flex-1">
                            <p className="px-2 text-[10px] font-medium text-zinc-400 mb-2">Agents</p>
                            <nav className="space-y-0.5">
                                {agents.map((agent) => (
                                    <button
                                        key={agent.id}
                                        disabled={!agent.active}
                                        className={cn(
                                            "w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px]",
                                            agent.active
                                                ? activeAgentId === agent.id
                                                    ? "bg-zinc-100 text-zinc-900 font-medium"
                                                    : "text-zinc-600"
                                                : "text-zinc-400 opacity-50 cursor-not-allowed"
                                        )}
                                        onClick={() => handleSelectAgent(agent.id)}
                                    >
                                        <agent.icon className="w-3.5 h-3.5" />
                                        <span>{agent.name}</span>
                                        {!agent.active && <span className="ml-auto text-[9px] text-zinc-400 font-medium">Soon</span>}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </aside>
                </div>
            )}

            {/* ─── Main Content ─── */}
            <main className="flex-1 flex flex-col min-w-0 bg-white">
                {activeAgentId ? (
                    <>
                        {/* Toolbar */}
                        <header className="flex items-center h-12 px-4 md:px-6 border-b border-zinc-100 shrink-0">
                            <button className="md:hidden p-1.5 -ml-1 mr-2 text-zinc-400" onClick={() => setMobileMenuOpen(true)}>
                                <Menu className="w-4 h-4" />
                            </button>
                            <div className="flex items-center gap-1.5 text-[13px] text-zinc-400">
                                <button onClick={() => setActiveAgentId(null)} className="hover:text-zinc-600 transition-colors">Intelligence</button>
                                <ChevronRight className="w-3 h-3" />
                                <span className="text-zinc-900 font-medium">{activeAgent.name}</span>
                            </div>
                        </header>

                        {/* Messages */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto">
                            <div className="max-w-[680px] mx-auto px-5 md:px-0 py-8 md:py-12 space-y-10">
                                {messages.map((message, i) => (
                                    <div key={i} className="animate-in fade-in duration-300">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-white", message.role === "user" ? "bg-zinc-300" : "bg-zinc-900")}>
                                                {message.role === "assistant" ? <activeAgent.icon className="w-3 h-3" /> : <User className="w-3 h-3" />}
                                            </div>
                                            <span className="text-[12px] font-medium text-zinc-500">
                                                {message.role === "user" ? "You" : activeAgent.name}
                                            </span>
                                        </div>

                                        <div className={cn("pl-7", message.role === "user" && "text-zinc-600 italic")}>
                                            {message.role === "assistant" && message.content === "" ? (
                                                <div className="flex gap-1 items-center h-5">
                                                    <div className="w-1 h-1 bg-zinc-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                                    <div className="w-1 h-1 bg-zinc-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                                    <div className="w-1 h-1 bg-zinc-300 rounded-full animate-bounce" />
                                                </div>
                                            ) : (
                                                <div className="prose prose-sm prose-zinc max-w-none text-[14px]">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            table: ({ children }) => (
                                                                <div className="overflow-x-auto my-4 rounded-lg border border-zinc-100">
                                                                    <table className="min-w-full divide-y divide-zinc-100">{children}</table>
                                                                </div>
                                                            ),
                                                            thead: ({ children }) => <thead className="bg-zinc-50">{children}</thead>,
                                                            th: ({ children }) => <th className="px-3 py-2 text-left text-[11px] font-medium text-zinc-500">{children}</th>,
                                                            td: ({ children }) => <td className="px-3 py-2 text-[12px] text-zinc-700 border-t border-zinc-50">{children}</td>,
                                                            h3: ({ children }) => <h3 className="text-[14px] font-semibold text-zinc-900 mt-6 mb-2">{children}</h3>,
                                                            ul: ({ children }) => <ul className="my-3 space-y-1">{children}</ul>,
                                                            li: ({ children }) => (
                                                                <li className="flex items-start gap-2 text-[13px] text-zinc-700 leading-relaxed">
                                                                    <span className="mt-2 w-1 h-1 rounded-full bg-zinc-300 shrink-0" />
                                                                    <span>{children}</span>
                                                                </li>
                                                            ),
                                                            p: ({ children }) => <p className="text-[14px] text-zinc-700 leading-relaxed mb-4 last:mb-0">{children}</p>,
                                                            strong: ({ children }) => <strong className="font-semibold text-zinc-900">{children}</strong>,
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

                        {/* Input */}
                        <div className="border-t border-zinc-100 px-4 md:px-0 bg-white">
                            <form onSubmit={handleSubmit} className="max-w-[680px] mx-auto py-4">
                                <div className="flex items-center gap-2 bg-zinc-50 rounded-xl px-4 py-1 border border-zinc-200 focus-within:border-zinc-400 transition-colors">
                                    <Input
                                        ref={inputRef}
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder={`Ask ${activeAgent.name} a question…`}
                                        className="bg-transparent border-none focus-visible:ring-0 h-10 text-[14px] text-zinc-900 placeholder:text-zinc-400"
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="submit"
                                        disabled={isLoading || !input.trim()}
                                        className="w-7 h-7 rounded-lg bg-zinc-900 text-white flex items-center justify-center shrink-0 disabled:opacity-20 hover:bg-zinc-800 active:scale-95 transition-all"
                                    >
                                        <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <p className="text-center text-[10px] text-zinc-300 mt-3">CL Intelligence · City of Dreams Sri Lanka</p>
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
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                                {agents.map((agent) => (
                                    <button
                                        key={agent.id}
                                        disabled={!agent.active}
                                        onClick={() => handleSelectAgent(agent.id)}
                                        className={cn(
                                            "flex flex-col items-start p-6 rounded-2xl border text-left transition-all duration-300 relative group",
                                            agent.active
                                                ? "bg-white border-zinc-100 hover:border-zinc-200 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-1"
                                                : "bg-zinc-50 border-zinc-50/50 opacity-60 cursor-not-allowed"
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

                                        <div className="mt-auto flex items-center gap-1.5 text-[12px] font-medium transition-all duration-300">
                                            {agent.active ? (
                                                <>
                                                    <span className="text-zinc-900">Start chat</span>
                                                    <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all text-zinc-900" />
                                                </>
                                            ) : (
                                                <span className="text-zinc-300">Coming soon</span>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>

                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
