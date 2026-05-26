import React, { useState, useEffect, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { Menu, Folder, Cloud, HardDrive, Github, Settings, Terminal, MessageSquare, Save, Plus, Trash2, Upload, Download, RefreshCw, Zap, Moon, Sun, Grid, Columns } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Mobile-first collapsible panels using CSS Grid + media queries
const App = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState('ai');
  const [showCreatorPanel, setShowCreatorPanel] = useState(false);
  
  // AI state
  const [aiProviders] = useState(['openai', 'gemini', 'cohere', 'huggingface', 'groq', 'mistral', 'anthropic', 'replicate', 'together', 'deepseek']);
  const [selectedAi, setSelectedAi] = useState('openai');
  const [chatMessages, setChatMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  
  // Terminal
  const [terminalOutput, setTerminalOutput] = useState('');
  const wsRef = useRef(null);
  const [cmd, setCmd] = useState('');
  
  // Files
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  
  // Env vars (creator only)
  const [envVars, setEnvVars] = useState({});
  
  // Layout mode: 'grid' (default) or 'stacked' for mobile
  const [layoutMode, setLayoutMode] = useState('grid');

  // Auto-login
  const login = async (username, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    const data = await res.json();
    if (data.token) { localStorage.setItem('token', data.token); setToken(data.token); setUser(data.user); }
  };

  useEffect(() => {
    if (!token) { login('shaoncmd@gmail.com', 'Maynul@1989'); return; }
    fetch(`${API_URL}/api/projects`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(setFiles);
    if (user?.username === 'shaoncmd@gmail.com') {
      fetch(`${API_URL}/api/env`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(setEnvVars);
    }
    // WebSocket terminal
    const ws = new WebSocket(`ws://${window.location.hostname}:3000/terminal`);
    ws.onmessage = (ev) => { const data = JSON.parse(ev.data); setTerminalOutput(prev => prev + data.output + '\n'); };
    wsRef.current = ws;
    return () => ws.close();
  }, [token, user]);

  const sendCommand = () => { if (cmd.trim()) wsRef.current?.send(cmd); setCmd(''); };
  const sendAiPrompt = async () => {
    const res = await fetch(`${API_URL}/api/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ provider: selectedAi, prompt }) });
    const data = await res.json();
    setChatMessages([...chatMessages, { role: 'user', content: prompt }, { role: 'ai', content: data.response }]);
    setPrompt('');
  };
  const saveFile = async () => {
    if (currentFile) {
      await fetch(`${API_URL}/api/projects/${currentFile.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ content: editorContent }) });
    } else {
      const res = await fetch(`${API_URL}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: 'newfile.js', content: editorContent }) });
      const data = await res.json();
      setFiles([...files, { id: data.id, name: 'newfile.js', content: editorContent }]);
    }
  };
  const deleteFile = async (id) => {
    await fetch(`${API_URL}/api/projects/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setFiles(files.filter(f => f.id !== id));
    if (currentFile?.id === id) setCurrentFile(null);
  };
  const createNewFile = () => { setCurrentFile(null); setEditorContent('// Write your code here'); };
  const updateEnv = async (key, value) => {
    await fetch(`${API_URL}/api/env`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ [key]: value }) });
    setEnvVars({ ...envVars, [key]: value });
  };
  const backupToGitHub = async () => {
    const repo = prompt('GitHub repo name (user/repo):');
    if (repo) await fetch(`${API_URL}/api/github/backup`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ repo }) });
  };

  // Responsive layout classes
  const containerClass = layoutMode === 'grid' 
    ? "grid grid-cols-1 md:grid-cols-[280px,1fr,320px] gap-2 p-2"
    : "flex flex-col gap-2 p-2";
  const sidebarClass = "bg-gray-800 rounded-lg p-3 overflow-auto";
  const editorClass = "bg-gray-900 rounded-lg overflow-hidden flex flex-col";
  const rightPanelClass = "bg-gray-800 rounded-lg flex flex-col";

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-950 text-gray-100' : 'bg-gray-100 text-gray-900'}`}>
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur bg-black/80 border-b border-cyan-500/30 p-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 rounded hover:bg-gray-700"><Menu size={20} /></button>
          <button onClick={() => setRightPanelOpen(!rightPanelOpen)} className="p-1 rounded hover:bg-gray-700"><Columns size={20} /></button>
          <button onClick={() => setLayoutMode(layoutMode === 'grid' ? 'stacked' : 'grid')} className="p-1 rounded hover:bg-gray-700"><Grid size={20} /></button>
          <button onClick={() => setDarkMode(!darkMode)} className="p-1 rounded hover:bg-gray-700">{darkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
          <h1 className="text-cyan-400 font-mono text-lg hidden sm:block">⚡ CyberPwr IDE</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={createNewFile} className="bg-green-600 px-2 py-1 rounded text-xs"><Plus size={14} className="inline" /> New</button>
          <button onClick={backupToGitHub} className="bg-purple-600 px-2 py-1 rounded text-xs"><Github size={14} className="inline" /> Backup</button>
          {user?.username === 'shaoncmd@gmail.com' && (
            <button onClick={() => setShowCreatorPanel(!showCreatorPanel)} className={`px-2 py-1 rounded text-xs ${showCreatorPanel ? 'bg-cyan-600' : 'bg-gray-700'}`}><Settings size={14} className="inline" /> Creator</button>
          )}
        </div>
      </header>

      {/* Main Layout */}
      <div className={containerClass}>
        {/* Left Panel - Explorer */}
        {sidebarOpen && (
          <div className={sidebarClass}>
            <div className="flex items-center justify-between mb-3"><Folder size={18} /> Explorer <button onClick={createNewFile}><Plus size={16} /></button></div>
            {files.map(f => (
              <div key={f.id} className="flex justify-between items-center p-1 hover:bg-gray-700 rounded cursor-pointer">
                <span onClick={() => { setCurrentFile(f); setEditorContent(f.content || ''); }}>{f.name}</span>
                <button onClick={() => deleteFile(f.id)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}

        {/* Center - Editor */}
        <div className={editorClass}>
          <div className="bg-gray-800 p-2 flex justify-between items-center">
            <span className="text-sm truncate">{currentFile?.name || 'untitled'}</span>
            <button onClick={saveFile} className="bg-blue-600 px-2 py-1 rounded text-xs"><Save size={14} className="inline" /> Save</button>
          </div>
          <MonacoEditor theme={darkMode ? 'vs-dark' : 'light'} language="javascript" value={editorContent} onChange={setEditorContent} className="flex-1 min-h-[300px]" />
        </div>

        {/* Right Panel - AI / Terminal / Creator Env */}
        {rightPanelOpen && (
          <div className={rightPanelClass}>
            <div className="flex border-b border-gray-700">
              <button className={`flex-1 p-2 flex items-center justify-center gap-1 ${activeRightTab === 'ai' ? 'bg-cyan-600' : ''}`} onClick={() => setActiveRightTab('ai')}><MessageSquare size={16} /> AI</button>
              <button className={`flex-1 p-2 flex items-center justify-center gap-1 ${activeRightTab === 'term' ? 'bg-cyan-600' : ''}`} onClick={() => setActiveRightTab('term')}><Terminal size={16} /> Terminal</button>
              {showCreatorPanel && (
                <button className={`flex-1 p-2 flex items-center justify-center gap-1 ${activeRightTab === 'env' ? 'bg-cyan-600' : ''}`} onClick={() => setActiveRightTab('env')}><Settings size={16} /> Env</button>
              )}
            </div>

            {/* AI Tab */}
            {activeRightTab === 'ai' && (
              <div className="flex-1 flex flex-col p-3 overflow-auto">
                <select value={selectedAi} onChange={e => setSelectedAi(e.target.value)} className="bg-gray-900 p-2 rounded mb-3">
                  {aiProviders.map(p => <option key={p}>{p}</option>)}
                </select>
                <div className="flex-1 overflow-auto border border-gray-700 rounded p-2 mb-3 h-64">
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`mb-2 ${m.role === 'user' ? 'text-blue-300' : 'text-green-300'}`}><b>{m.role}:</b> {m.content}</div>
                  ))}
                </div>
                <textarea rows={3} className="bg-gray-900 p-2 rounded mb-2" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ask AI..." />
                <button onClick={sendAiPrompt} className="bg-cyan-700 p-2 rounded">Generate</button>
              </div>
            )}

            {/* Terminal Tab */}
            {activeRightTab === 'term' && (
              <div className="flex-1 flex flex-col p-3">
                <pre className="flex-1 overflow-auto bg-black p-2 text-green-400 rounded text-xs h-64">{terminalOutput}</pre>
                <div className="flex mt-2">
                  <span className="bg-gray-900 p-2 rounded-l">$</span>
                  <input className="flex-1 bg-gray-900 p-2 rounded-r" value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendCommand()} placeholder="Command..." />
                </div>
              </div>
            )}

            {/* Creator Env Tab */}
            {activeRightTab === 'env' && showCreatorPanel && (
              <div className="flex-1 overflow-auto p-3">
                <h3 className="font-bold mb-2">AI API Keys</h3>
                {Object.entries(envVars).map(([key, val]) => (
                  <div key={key} className="mb-2">
                    <label className="text-xs block">{key}</label>
                    <input type="text" defaultValue={val} onBlur={e => updateEnv(key, e.target.value)} className="w-full bg-gray-900 p-1 rounded text-sm" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
