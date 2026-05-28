import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { Note } from '../../types/cast-types';
import { DEFAULT_NOTE_CATEGORIES } from '../../types/cast-types';
import { useKnowledgeStore } from '../../store/useKnowledgeStore';
import { saveCastContext } from '../../utils/cast/cast-memory-bridge';
import * as api from '../../api';
import FileImportExportBar from './FileImportExportBar';

const KnowledgeBase: React.FC = () => {
  const {
    notes, categories, selectedNoteId, searchQuery,
    setSearchQuery, selectNote, addNote, updateNote, deleteNote,
    getFilteredNotes, getAllTags, searchNotes, generateSummary,
    loadFromStorage
  } = useKnowledgeStore();

  const [showEditor, setShowEditor] = useState(false);
  const [editingContent, setEditingContent] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [promotedNoteId, setPromotedNoteId] = useState<string | null>(null);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const filteredNotes = useMemo(() => getFilteredNotes(), [notes, searchQuery, getFilteredNotes]);
  const selectedNote = useMemo(() => notes.find(n => n.id === selectedNoteId) || null, [notes, selectedNoteId]);
  const allTags = useMemo(() => getAllTags(), [notes, getAllTags]);

  const handleNewNote = useCallback(() => {
    const id = addNote({
      title: '无标题笔记',
      content: '',
      category: 'work',
      tags: [],
      links: []
    });
    selectNote(id);
    setEditingContent('');
    setShowEditor(true);
  }, [addNote, selectNote]);

  const handleSaveNote = useCallback(() => {
    if (!selectedNoteId) return;
    updateNote(selectedNoteId, { content: editingContent });
    setShowEditor(false);
  }, [selectedNoteId, editingContent, updateNote]);

  const handleAISummary = useCallback(async () => {
    if (!selectedNote || !selectedNote.content.trim()) return;
    setIsGeneratingSummary(true);
    try {
      const summaryText = await generateSummary(selectedNote.content);
      if (summaryText && selectedNoteId) {
        updateNote(selectedNoteId, { summary: summaryText });
      }
    } catch (error) {
      console.error('[KnowledgeBase] AI summary failed:', error);
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [selectedNote, selectedNoteId, updateNote, generateSummary]);

  const handlePromoteToMemory = useCallback(async () => {
    if (!selectedNote) return;
    await saveCastContext({
      content: `[笔记] ${selectedNote.title}: ${selectedNote.content.slice(0, 300)}`,
      tags: [...selectedNote.tags, 'knowledge-base', selectedNote.category],
      metadata: { noteId: selectedNote.id, sourcePanel: 'knowledge' }
    });
    setPromotedNoteId(selectedNoteId);
    setTimeout(() => setPromotedNoteId(null), 2000);
  }, [selectedNote]);

  const handleImportFile = useCallback((content: string, filename: string) => {
    addNote({
      title: filename.replace(/\.[^/.]+$/, ''),
      content,
      category: 'work',
      tags: ['imported'],
      links: []
    });
  }, [addNote]);

  const simpleMarkdownRender = (text: string): string => {
    return text
      .replace(/^### (.*$)/gim, '<h4 style="margin:8px 0 4px;color:var(--text-primary)">$1</h4>')
      .replace(/^## (.*$)/gim, '<h3 style="margin:10px 0 5px;color:var(--text-primary)">$1</h3>')
      .replace(/^# (.*$)/gim, '<h2 style="margin:12px 0 6px;color:#c084fc">$1</h2>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- \[(x| )\] (.*$)/gim, (_, checked, item) =>
        `<div style="display:flex;gap:6px;align-items:center;margin:3px 0"><span style="color:${checked === 'x' ? '#10b981' : '#666'}">${checked === 'x' ? '\u2611' : '\u2610'}</span><span>${item}</span></div>`
      )
      .replace(/^- (.*$)/gim, '<li style="margin-left:16px">$1</li>')
      .replace(/\n\n/g, '</p><p style="margin:6px 0">')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="cast-panel-container" style={{ padding: 0, display: 'flex', height: '100%' }}>
      <div style={{
        width: showEditor ? '40%' : '280px',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        transition: 'width 0.2s ease'
      }}>
        <div className="cast-toolbar" style={{ padding: '8px 12px', gap: 6 }}>
          <div className="cast-toolbar-btn" style={{ flex: 1 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="\u{1F50D} 搜索笔记..."
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '11.5px',
                outline: 'none'
              }}
            />
          </div>
          <button className="cast-toolbar-btn" onClick={handleNewNote}>+ 新建</button>
          <FileImportExportBar mode="import" onImport={handleImportFile} compact accept=".txt,.md,.json,.csv" />
        </div>

        {allTags.length > 0 && (
          <div style={{
            padding: '6px 12px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            borderBottom: '1px solid rgba(255,255,255,0.04)'
          }}>
            {allTags.map(([tag, count]) => (
              <span key={tag} className="cast-tag cast-tag-purple" style={{ cursor: 'pointer', fontSize: '10px' }} onClick={() => setSearchQuery(tag)}>
                {tag} ({count})
              </span>
            ))}
          </div>
        )}

        <div style={{ padding: '4px 12px', fontSize: '10px', color: 'var(--text-muted)' }}>
          共 {filteredNotes.length} 条笔记 · {categories.length} 个分类
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredNotes.map(note => {
            const cat = DEFAULT_NOTE_CATEGORIES.find(c => c.id === note.category);
            return (
              <div
                key={note.id}
                className="cast-list-item"
                onClick={() => { selectNote(note.id); setEditingContent(note.content); setShowEditor(false); }}
                style={{
                  background: note.id === selectedNoteId ? 'rgba(192,132,252,0.06)' : undefined,
                  padding: '10px 12px'
                }}
              >
                <span className="cast-list-item-icon">{cat?.icon || '\u{1F4D4}'}</span>
                <div className="cast-list-item-content">
                  <div className="cast-list-item-title">{note.title}</div>
                  <div className="cast-list-item-subtitle">
                    {note.tags.slice(0, 2).map(t => (
                      <span key={t} className="cast-tag" style={{ marginRight: 4, fontSize: '9.5px', padding: '1px 6px' }}>{t}</span>
                    ))}
                    <span style={{ opacity: 0.5, fontSize: '10px' }}>
                      {new Date(note.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {selectedNote ? (
          <>
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{selectedNote.title}</h3>
                <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
                  {selectedNote.tags.map(t => (
                    <span key={t} className="cast-tag cast-tag-purple">{t}</span>
                  ))}
                  {selectedNote.summary && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>
                      💡 {selectedNote.summary.slice(0, 40)}...
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
                <button className="cast-toolbar-btn" onClick={handleAISummary} disabled={isGeneratingSummary}>
                  {isGeneratingSummary ? '\u{23F3} 摘要中...' : '\u{1F9E0} AI摘要'}
                </button>
                <button
                  className={`cast-toolbar-btn ${promotedNoteId === selectedNoteId ? 'active' : ''}`}
                  onClick={handlePromoteToMemory}
                  disabled={!selectedNote}
                  title="将笔记提升为长期记忆，可在对话中自动召回"
                >
                  {promotedNoteId === selectedNoteId ? '\u2705 已提升' : '\u{1F4BE} 提升记忆'}
                </button>
                <button className="cast-toolbar-btn" onClick={() => { setEditingContent(selectedNote.content); setShowEditor(!showEditor); }}>
                  {showEditor ? '\u{1F441} 查看' : '\u270F\uFE0F 编辑'}
                </button>
                <button className="cast-toolbar-btn" onClick={() => deleteNote(selectedNote.id)} title="删除笔记" style={{ borderColor: '#ef4444', color: '#ef4444' }}>
                  🗑
                </button>
              </div>
            </div>

            {showEditor ? (
              <div className="cast-editor-area" style={{ flex: 1 }}>
                <textarea className="cast-editor-textarea" value={editingContent} onChange={(e) => setEditingContent(e.target.value)} placeholder="编辑笔记内容（支持 Markdown）..." />
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  padding: '8px 16px', display: 'flex', gap: 8, justifyContent: 'flex-end',
                  background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)'
                }}>
                  <button className="cast-toolbar-btn" onClick={() => setShowEditor(false)}>取消</button>
                  <button className="cast-toolbar-btn active" onClick={handleSaveNote}>保存</button>
                </div>
              </div>
            ) : (
              <div className="cast-preview-area" style={{ padding: '18px 22px' }} dangerouslySetInnerHTML={{
                __html: `<div>${simpleMarkdownRender(selectedNote.content)}</div>`
              }} />
            )}
          </>
        ) : (
          <div className="cast-empty-state">
            <div className="cast-empty-icon">📚</div>
            <h4>知识库</h4>
            <p>选择一条笔记查看，或创建新笔记</p>
            <p className="hint">支持 Markdown 格式、标签分类、全文搜索、AI 摘要生成</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(KnowledgeBase);
