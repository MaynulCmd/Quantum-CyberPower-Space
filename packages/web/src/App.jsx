import React, { useState, useEffect, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from 'react-resizable-panels';
import { Menu, Folder, Cloud, HardDrive, Github, Settings } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [aiProviders] = useState(['openai', 'gemini', 'cohere', 'huggingface', 'groq', 'mistral', 'anthropic', 'replicate', 'together', 'deepseek']);
  const [selectedAi, setSelectedAi] = useState('openai');
  const [chatMessages, setChatMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [terminalOutput, setTerminalOutput] = useState('');
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState('ai');
  const [showCreatorPanel, setShowCreatorPanel] = useState(false);
  const [envVars, setEnvVars] = useState({});
  const wsRef = useRef(null);

  // Auto-login creator
  const login = async (username, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    const data = await res.json();
    if (data.token) { localStorage.setItem('token', data.token); setToken(data.token); setUser(data.user); }
  };

  useEffect(() => {
    if (!token) {
      login('shaoncmd@gmail.com', 'Maynul@1989');
      return;
    }
    fetch(`${API_URL}/api/projects`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(setFiles);
    fetch(`${API_URL}/api/env`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(setEnvVars);
    const ws = new WebSocket(`ws://${window.location.hostname}:3000/terminal`);
    ws.onmessage = (ev) => { const data = JSON.parse(ev.data); setTerminalOutput(prev => prev + data.output + '\n'); };
    wsRef.current = ws;
    return () => ws.close();
  }, [token]);

  const sendCommand = (cmd) => wsRef.current?.send(cmd);
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
  const updateEnv = async (key, value) => {
    await fetch(`${API_URL}/api/env`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ [key]: value }) });
    setEnvVars({ ...envVars, [key]: value });
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100">
      <header className="bg-black/80 backdrop-blur p-2 flex justify-between items-center border-b border-cyan-500/30">
        <div className="flex gap-2">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2"><Menu size={24} /></button>
          {user?.username === 'shaoncmd@gmail.com' && (
            <button onClick={() => setShowCreatorPanel(!showCreatorPanel)} className="p-2"><Settings size={24} /></button>
          )}
        </div>
        <h1 className="text-cyan-400 font-mono text-lg">⚡ CyberPwr IDE</h1>
        <div className="flex gap-2"><Cloud size={20} /><HardDrive size={20} /><Github size={20} /></div>
      </header>
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {sidebarOpen && (
          <ResizablePanel defaultSize={20} minSize={15}>
            <div className="bg-gray-800 p-2 h-full overflow-auto">
              <div className="flex items-center gap-2 mb-4"><Folder size={18} /> Explorer</div>
              {files.map(f => (
                <div key={f.id} onClick={() => { setCurrentFile(f); setEditorContent(f.content || ''); }} className="p-1 hover:bg-gray-700 rounded cursor-pointer">{f.name}</div>
              ))}
            </div>
          </ResizablePanel>
        )}
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50}>
          <div className="h-full flex flex-col">
            <div className="bg-gray-800 p-1 flex justify-between"><span>{currentFile?.name || 'untitled'}</span><button onClick={saveFile} className="bg-green-600 px-2 rounded text-xs">💾 Save</button></div>
            <MonacoEditor theme="vs-dark" language="javascript" value={editorContent} onChange={setEditorContent} className="flex-1" />
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={30}>
          <div className="bg-gray-800/50 h-full flex flex-col">
            <div className="flex border-b border-gray-700">
              <button className={`p-2 ${activeRightTab === 'ai' ? 'bg-cyan-600' : ''}`} onClick={() => setActiveRightTab('ai')}>🤖 AI Chat</button>
              <button className={`p-2 ${activeRightTab === 'term' ? 'bg-cyan-600' : ''}`} onClick={() => setActiveRightTab('term')}>$ Terminal</button>
              {showCreatorPanel && <button className={`p-2 ${activeRightTab === 'env' ? 'bg-cyan-600' : ''}`} onClick={() => setActiveRightTab('env')}>⚙️ Env</button>}
            </div>
            {activeRightTab === 'ai' && (
              <div className="flex-1 flex flex-col p-2">
                <select value={selectedAi} onChange={e=>setSelectedAi(e.target.value)} className="bg-gray-900 p-1 rounded mb-2">
                  {aiProviders.map(p=><option key={p}>{p}</option>)}
                </select>
                <div className="flex-1 overflow-auto border border-gray-700 p-2 rounded mb-2">
                  {chatMessages.map((m,i)=> <div key={i} className={`${m.role==='user'?'text-blue-300':'text-green-300'} mb-1`}><b>{m.role}:</b> {m.content}</div>)}
                </div>
                <textarea rows={2} className="bg-gray-900 p-2 rounded mb-2" value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Ask AI..."/>
                <button onClick={sendAiPrompt} className="bg-cyan-700 p-2 rounded">Send</button>
              </div>
            )}
            {activeRightTab === 'term' && (
              <div className="flex-1 flex flex-col p-2">
                <pre className="flex-1 overflow-auto bg-black p-2 text-green-400 rounded text-xs">{terminalOutput}</pre>
                <div className="flex mt-2"><span className="bg-gray-900 p-1 rounded-l">$</span><input className="flex-1 bg-gray-900 p-1 rounded-r" onKeyDown={e=>e.key==='Enter'&&sendCommand(e.target.value)} placeholder="Command..."/></div>
              </div>
            )}
            {activeRightTab === 'env' && (
              <div className="flex-1 flex flex-col p-2 overflow-auto">
                <h3 className="text-sm font-bold mb-2">Environment Variables</h3>
                {Object.entries(envVars).map(([key, val]) => (
                  <div key={key} className="mb-2">
                    <label className="text-xs block">{key}</label>
                    <input type="text" defaultValue={val} onBlur={(e) => updateEnv(key, e.target.value)} className="w-full bg-gray-900 p-1 rounded text-sm" />
                  </div>
                ))}
                <p className="text-xs text-gray-400 mt-2">Changes are saved to .env and reloaded instantly.</p>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export default App;
