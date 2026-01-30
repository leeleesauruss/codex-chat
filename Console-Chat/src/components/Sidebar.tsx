import React, { useState } from 'react';
import { Button, Nav, Accordion, Stack, Modal, Form } from 'react-bootstrap';
import { useAppStore } from '../store';
import { Folder as FolderIcon, ChatLeftText, Trash, PencilSquare, FolderPlus, PlusCircle } from 'react-bootstrap-icons';

interface SidebarProps {
  onShowSettings: () => void;
  onShowOptimization: () => void;
  onShowThemeBrowser: () => void;
  onShowRag: () => void;
}

export function Sidebar({ onShowSettings, onShowOptimization, onShowThemeBrowser, onShowRag }: SidebarProps) {
  const { 
    folders, 
    chats, 
    currentChatId, 
    selectChat, 
    createChat, 
    createFolder, 
    deleteChat, 
    deleteFolder,
    renameChat,
    renameFolder,
    toggleTheme 
  } = useAppStore();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [isRenamingFolder, setIsRenamingFolder] = useState(false);

  // Group chats by folder
  const chatsInFolder = (folderId: string) => chats.filter(c => c.folderId === folderId);
  const rootChats = chats.filter(c => !c.folderId);

  const handleCreateChat = () => {
    const newId = createChat('New Chat');
    selectChat(newId);
  };

  const startRename = (id: string, currentName: string, isFolder: boolean) => {
    setRenamingId(id);
    setRenameText(currentName);
    setIsRenamingFolder(isFolder);
  };

  const confirmRename = () => {
    if (renamingId) {
        if (isRenamingFolder) {
            renameFolder(renamingId, renameText);
        } else {
            renameChat(renamingId, renameText);
        }
    }
    setRenamingId(null);
  };

  return (
    <div className="d-flex flex-column h-100 p-2">
      <div className="mb-3 d-flex gap-2">
        <Button variant="primary" size="sm" className="flex-grow-1" onClick={handleCreateChat}>
          <PlusCircle className="me-1" /> New Chat
        </Button>
        <Button variant="outline-secondary" size="sm" onClick={() => createFolder("New Folder")}>
          <FolderPlus />
        </Button>
      </div>

      <div className="flex-grow-1 overflow-auto">
        <Stack gap={1}>
          {/* Folders */}
          {folders.map(folder => (
             <div key={folder.id} className="mb-1">
                <div className="d-flex align-items-center justify-content-between p-1 bg-body-tertiary rounded">
                    <div className="d-flex align-items-center gap-2 text-truncate fw-bold small">
                        <FolderIcon /> {folder.name}
                    </div>
                    <div className="d-flex gap-1">
                        <Button variant="link" size="sm" className="p-0 text-muted" onClick={() => startRename(folder.id, folder.name, true)}><PencilSquare size={12}/></Button>
                        <Button variant="link" size="sm" className="p-0 text-danger" onClick={() => deleteFolder(folder.id)}><Trash size={12}/></Button>
                    </div>
                </div>
                <div className="ps-3 border-start ms-2 mt-1">
                    {chatsInFolder(folder.id).map(chat => (
                        <div 
                            key={chat.id} 
                            className={`d-flex align-items-center justify-content-between p-1 rounded ${currentChatId === chat.id ? 'bg-primary-subtle' : 'hover-bg-light'}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => selectChat(chat.id)}
                        >
                            <div className="text-truncate small" style={{ maxWidth: '140px' }}>
                                <ChatLeftText className="me-2 text-muted" size={10} />
                                {chat.title}
                            </div>
                            {currentChatId === chat.id && (
                                <div className="d-flex gap-1">
                                    <Button variant="link" size="sm" className="p-0 text-muted" onClick={(e) => { e.stopPropagation(); startRename(chat.id, chat.title, false); }}><PencilSquare size={10}/></Button>
                                    <Button variant="link" size="sm" className="p-0 text-danger" onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}><Trash size={10}/></Button>
                                </div>
                            )}
                        </div>
                    ))}
                    {chatsInFolder(folder.id).length === 0 && <div className="small text-muted fst-italic ps-2">Empty</div>}
                    <Button variant="link" size="sm" className="p-0 text-decoration-none small ps-2 mt-1" onClick={() => createChat('New Chat', folder.id)}>+ New Chat</Button>
                </div>
             </div>
          ))}

          {/* Root Chats */}
          {rootChats.map(chat => (
            <div 
                key={chat.id} 
                className={`d-flex align-items-center justify-content-between p-2 rounded ${currentChatId === chat.id ? 'bg-primary-subtle' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => selectChat(chat.id)}
            >
                <div className="text-truncate small">
                    <ChatLeftText className="me-2" />
                    {chat.title}
                </div>
                {currentChatId === chat.id && (
                    <div className="d-flex gap-1">
                        <Button variant="link" size="sm" className="p-0 text-muted" onClick={(e) => { e.stopPropagation(); startRename(chat.id, chat.title, false); }}><PencilSquare size={12}/></Button>
                        <Button variant="link" size="sm" className="p-0 text-danger" onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}><Trash size={12}/></Button>
                    </div>
                )}
            </div>
          ))}
        </Stack>
      </div>

      <hr />
      <div className="d-grid gap-2">
         <Button variant="outline-primary" size="sm" onClick={onShowOptimization}>Optimization</Button>
         <Button variant="secondary" size="sm" onClick={onShowSettings}>API Settings</Button>
         <Button variant="outline-success" size="sm" onClick={onShowRag}>RAG Context</Button>
         <Button variant="outline-info" size="sm" onClick={onShowThemeBrowser}>Theme Catalog</Button>
         <Button variant="outline-secondary" size="sm" onClick={toggleTheme}>Toggle Theme</Button>
      </div>

      {/* Rename Modal */}
      <Modal show={!!renamingId} onHide={() => setRenamingId(null)} size="sm" centered>
        <Modal.Body>
            <Form.Control 
                autoFocus
                value={renameText} 
                onChange={(e) => setRenameText(e.target.value)} 
                onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); }}
            />
        </Modal.Body>
        <Modal.Footer className="p-1">
            <Button size="sm" variant="secondary" onClick={() => setRenamingId(null)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={confirmRename}>Save</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
