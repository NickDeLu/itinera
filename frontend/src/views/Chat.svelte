<script>
  import { onMount, onDestroy } from 'svelte';
  import { streamChat } from '../lib/api.js';
  import Icon from '../lib/Icon.svelte';

  let { user } = $props();

  let messages = $state([]);
  let input = $state('');
  let isStreaming = $state(false);
  let error = $state('');
  let conversationHistory = $state([]);
  let abortController = $state(null);
  let accumulatedText = $state('');
  let toolDetailsState = $state({});

  let messagesEl = null;
  let inputEl = null;
  let activeAssistantId = $state(null);
  let hasReceivedText = $state(false);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (messagesEl) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    });
  }

  function handleSSEEvent(event, data) {
    switch (event) {
      case 'turn_start':
        accumulatedText = '';
        hasReceivedText = false;
        const id = crypto.randomUUID();
        activeAssistantId = id;
        messages = [...messages, { role: 'assistant', text: '', id, tools: [], toolsOpen: false, finalized: false }];
        break;

      case 'text_chunk': {
        accumulatedText += data.text || '';
        
        // Extract just the text value from the JSON stream
        const textMatch = accumulatedText.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)/);
        if (textMatch) {
          hasReceivedText = true;
          // Unescape the text (handles escaped quotes, backslashes, newlines)
          let extractedText = textMatch[1]
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t');
          // Remove trailing incomplete escape sequences
          extractedText = extractedText.replace(/\\$/, '');
          messages = messages.map(m =>
            m.id === activeAssistantId ? { ...m, text: extractedText } : m
          );
          scrollToBottom();
        }
        
        // Extract tools from the accumulated text (only if we haven't parsed them yet)
        const toolsMatch = accumulatedText.match(/"tools"\s*:\s*\[/);
        if (toolsMatch && activeAssistantId) {
          // Show tool collapsible as soon as we detect the tools array
          messages = messages.map(m => {
            if (m.id === activeAssistantId && m.tools.length === 0) {
              return { ...m, tools: [] };
            }
            return m;
          });
          
          // Try to parse actual tools
          try {
            const toolsStr = '[' + accumulatedText.match(/"tools"\s*:\s*\[([\s\S]*?)\]/)?.[1] || ']';
            const tools = JSON.parse(toolsStr);
            if (tools.length > 0) {
              messages = messages.map(m => {
                if (m.id === activeAssistantId && m.tools.length === 0) {
                  const newTools = tools.map((t) => ({
                    tool: t.tool,
                    status: 'running',
                    args: t.args,
                    result: null
                  }));
                  return { ...m, tools: newTools };
                }
                return m;
              });
            }
          } catch (e) {
            // Ignore parse errors for partial tool data
          }
        }
        break;
      }

      case 'turn_done': {
        // Parse the complete JSON to get final text and tools
        try {
          const parsed = JSON.parse(accumulatedText);
          if (parsed.text) {
            messages = messages.map(m =>
              m.id === activeAssistantId ? { ...m, text: parsed.text, finalized: true } : m
            );
          }
          // Add tools from the final response if they exist (even if empty array)
          if (parsed.tools && Array.isArray(parsed.tools)) {
            messages = messages.map(m => {
              if (m.id === activeAssistantId) {
                const newTools = parsed.tools.map((t) => ({
                  tool: t.tool,
                  status: 'running',
                  args: t.args,
                  result: null
                }));
                return { ...m, tools: newTools };
              }
              return m;
            });
          }
        } catch (e) {
          // If parsing fails, use the accumulated text as-is
          if (accumulatedText.trim()) {
            messages = messages.map(m =>
              m.id === activeAssistantId ? { ...m, text: accumulatedText, finalized: true } : m
            );
          }
        }
        break;
      }

      case 'tool_call':
        // Update existing tool with args if it exists, otherwise add it
        messages = messages.map(m => {
          if (m.id === activeAssistantId) {
            const existingIndex = m.tools.findIndex(t => t.tool === data.tool);
            if (existingIndex >= 0) {
              // Update args for existing tool
              const updatedTools = [...m.tools];
              updatedTools[existingIndex] = { ...updatedTools[existingIndex], args: data.args };
              return { ...m, tools: updatedTools };
            } else {
              // Add new tool
              return { ...m, tools: [...m.tools, { tool: data.tool, status: 'running', args: data.args, result: null }] };
            }
          }
          return m;
        });
        break;

      case 'tool_result':
        messages = messages.map(m => ({
          ...m,
          tools: (m.tools || []).map(t =>
            t.tool === data.tool ? { ...t, status: data.result?.error ? 'error' : 'done', result: data.result } : t
          ),
        }));
        break;

      case 'error':
        error = data.error || 'An error occurred.';
        break;

      case 'history':
        conversationHistory = data.history || [];
        break;

      case 'done':
        messages = messages.map(m =>
          m.id === activeAssistantId ? { ...m, finalized: true } : m
        );
        activeAssistantId = null;
        break;
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || isStreaming) return;

    input = '';
    error = '';
    messages = [...messages, { role: 'user', text }];
    scrollToBottom();
    isStreaming = true;

    let finished = false;
    const controller = streamChat(text, conversationHistory, {
      onEvent: (event, data) => {
        handleSSEEvent(event, data);
        if (event === 'done') finished = true;
      },
      onError: (msg) => { error = msg; finished = true; },
    });

    abortController = controller;

    // Poll until finished
    while (!finished) {
      await new Promise(r => setTimeout(r, 100));
    }
    isStreaming = false;
    abortController = null;
  }
  
  function stopStreaming() {
    if (abortController) {
      abortController.abort();
      abortController = null;
      isStreaming = false;
      hasReceivedText = false;
      messages = messages.map(m =>
        m.id === activeAssistantId ? { ...m, finalized: true } : m
      );
      activeAssistantId = null;
    }
  }

  function formatMarkdown(text) {
    if (!text) return '';
    // Escape HTML first
    let formatted = text
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>');
    // Convert **bold** to <strong>
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Convert *italic* to <em>
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Convert newlines to <br> for immediate rendering during streaming
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
  }

  function toggleTools(msgId) {
    messages = messages.map(m =>
      m.id === msgId ? { ...m, toolsOpen: !m.toolsOpen } : m
    );
  }

  function toggleToolDetail(msgId, toolName, section) {
    const key = `${msgId}-${toolName}-${section}`;
    toolDetailsState = {
      ...toolDetailsState,
      [key]: !toolDetailsState[key]
    };
  }

  function getToolDetailState(msgId, toolName, section) {
    const key = `${msgId}-${toolName}-${section}`;
    return toolDetailsState[key] || false;
  }

  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function resizeTextarea() {
    if (inputEl) {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
    }
  }
</script>

<div class="chat-layout">
  <!-- Header -->
  <header class="chat-header">
    <div class="header-left">
      <Icon name="logo" size={24} class="header-logo" />
      <div>
        <h1>Itinera</h1>
        <span class="header-subtitle">AI Travel Planner</span>
      </div>
    </div>
    <div class="header-right">
      <span class="user-badge">{user?.email || 'User'}</span>
    </div>
  </header>

  <!-- Error Banner -->
  {#if error}
    <div class="error-banner">
      {error}
      <button class="error-close" onclick={() => error = ''}>&times;</button>
    </div>
  {/if}

  <!-- Messages -->
  <div class="messages" bind:this={messagesEl}>
    {#if messages.length === 0}
      <div class="empty-state">
        <Icon name="globe" size={48} class="empty-icon" />
        <h2>Plan your next adventure</h2>
        <p>Ask Itinera to help plan a trip, create an itinerary, or explore destinations.</p>
      </div>
    {/if}

    {#each messages as msg}
      {#if msg.role === 'user'}
        <div class="message user">
          <div class="bubble">
            <div class="text">{msg.text}</div>
          </div>
        </div>
      {:else if msg.role === 'assistant'}
        {#if msg.text || msg.tools?.length > 0}
          <div class="message assistant">
            {#if msg.text}
              <div class="bubble">
                <div class="label">Itinera</div>
                <div class="text">{@html formatMarkdown(msg.text)}</div>
              </div>
            {/if}
            
            {#if msg.tools?.length > 0}
              <div class="tool-section">
                <div class="tool-header" onclick={() => toggleTools(msg.id)}>
                  <span class="tool-arrow" class:open={msg.toolsOpen}>▶</span>
                  <span>🔧 {msg.tools[msg.tools.length - 1]?.tool || 'Tools'}</span>
                  <span class="tool-summary">
                    {#if msg.tools.some(t => t.status === 'done')}✅{/if}
                    {#if msg.tools.some(t => t.status === 'error')}❌{/if}
                    {#if msg.tools.some(t => t.status === 'running')}⏳{/if}
                  </span>
                </div>
                <div class="tool-body" class:open={msg.toolsOpen}>
                  {#each msg.tools as tc}
                    <div class="tool-entry">
                      <div class="tool-status-line {tc.status}">
                        {#if tc.status === 'running'}⏳ {tc.tool}
                        {:else if tc.status === 'done'}✅ {tc.tool}
                        {:else}❌ {tc.tool}
                        {/if}
                      </div>
                      
                      <div class="tool-details">
                        <div class="tool-detail-header" onclick={() => toggleToolDetail(msg.id, tc.tool, 'input')}>
                          <span class="tool-detail-arrow" class:open={getToolDetailState(msg.id, tc.tool, 'input')}>▼</span>
                          Input
                        </div>
                        <pre class="tool-io" class:open={getToolDetailState(msg.id, tc.tool, 'input')}>{JSON.stringify(tc.args || {}, null, 2)}</pre>
                        
                        {#if tc.status !== 'running'}
                          <div class="tool-detail-header" onclick={() => toggleToolDetail(msg.id, tc.tool, 'output')}>
                            <span class="tool-detail-arrow" class:open={getToolDetailState(msg.id, tc.tool, 'output')}>▼</span>
                            Output
                          </div>
                          <pre class="tool-io" class:open={getToolDetailState(msg.id, tc.tool, 'output')}>{JSON.stringify(tc.result || {}, null, 2)}</pre>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      {/if}
    {/each}

    <!-- Typing Indicator - shows while waiting for first text chunk -->
    {#if isStreaming && !hasReceivedText}
      <div class="typing">
        <div class="typing-dots">
          <span></span><span></span><span></span>
        </div>
        <span class="typing-label">Itinera is thinking...</span>
      </div>
    {/if}
  </div>

  <!-- Input Bar -->
  <div class="input-bar">
    <div class="input-wrapper">
      <textarea
        bind:this={inputEl}
        bind:value={input}
        onkeydown={handleKeydown}
        oninput={resizeTextarea}
        rows="1"
        placeholder="Plan your trip..."
        disabled={isStreaming}
      ></textarea>
    </div>
    {#if isStreaming}
      <button class="btn btn-stop" onclick={stopStreaming}>
        <Icon name="stop" size={16} />
      </button>
    {:else}
      <button class="btn btn-send" onclick={sendMessage} disabled={!input.trim()}>
        <Icon name="send" size={16} />
      </button>
    {/if}
  </div>
</div>

<style>
  .chat-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
  }

  .chat-header {
    display: flex;
    align-items: center;
    padding: 12px 20px;
    padding-top: max(12px, env(safe-area-inset-top));
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    flex-shrink: 0;
    gap: 12px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
  }

  .header-logo {
    flex-shrink: 0;
  }

  .chat-header h1 {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.3px;
  }

  .header-subtitle {
    font-size: 11px;
    opacity: 0.8;
  }

  .header-right {
    flex-shrink: 0;
  }

  .user-badge {
    font-size: 12px;
    background: rgba(255,255,255,0.15);
    padding: 4px 10px;
    border-radius: 20px;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: inline-block;
  }

  .error-banner {
    display: flex;
    align-items: center;
    padding: 10px 16px;
    background: #fef2f2;
    border-bottom: 1px solid #fecaca;
    color: #ef4444;
    font-size: 13px;
    gap: 12px;
    flex-shrink: 0;
  }

  .error-close {
    margin-left: auto;
    background: none;
    border: none;
    color: #ef4444;
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--bg-light);
    -webkit-overflow-scrolling: touch;
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-secondary);
    margin-top: 40px;
  }

  .empty-icon {
    margin-bottom: 16px;
    color: var(--primary);
    opacity: 0.5;
  }

  .empty-state h2 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 8px;
  }

  .empty-state p {
    font-size: 14px;
    line-height: 1.6;
    max-width: 300px;
    margin: 0 auto;
  }

  .message {
    max-width: 88%;
    animation: msgIn 0.3s ease;
  }

  @keyframes msgIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .message.user {
    align-self: flex-end;
  }

  .message.user .bubble {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 16px;
    border-radius: 18px 18px 4px 18px;
    font-size: 15px;
    line-height: 1.5;
    word-wrap: break-word;
    white-space: pre-wrap;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
  }

  .message.assistant {
    align-self: flex-start;
    width: 100%;
    max-width: 100%;
  }

  .message.assistant .bubble {
    background: var(--surface);
    color: var(--text);
    padding: 14px 18px;
    border-radius: 18px 18px 18px 4px;
    font-size: 15px;
    line-height: 1.6;
    word-wrap: break-word;
    white-space: pre-wrap;
    border: 1px solid var(--border);
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }

  .label {
    font-size: 11px;
    font-weight: 700;
    color: var(--primary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .tool-section {
    margin-top: 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--bg-light);
  }

  .tool-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    user-select: none;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    transition: all 0.2s;
  }

  .tool-summary {
    margin-left: auto;
    font-size: 12px;
  }

  .tool-header:hover {
    background: var(--bg-light);
    color: var(--text);
  }

  .tool-arrow {
    transition: transform 0.2s;
    font-size: 10px;
    display: inline-block;
  }

  .tool-arrow.open {
    transform: rotate(90deg);
  }

  .tool-body {
    display: none;
    background: var(--surface);
    border-top: 1px solid var(--border);
  }

  .tool-body.open {
    display: block;
  }

  .tool-entry {
    border-bottom: 1px solid var(--border);
    padding: 10px 12px;
  }

  .tool-entry:last-child {
    border-bottom: none;
  }

  .tool-status-line {
    font-size: 12px;
    font-weight: 600;
    padding: 2px 0;
    color: var(--text);
  }

  .tool-status-line.done { color: #16a34a; }
  .tool-status-line.running { color: var(--primary); }
  .tool-status-line.error { color: #ef4444; }

  .tool-details {
    margin-top: 8px;
  }

  .tool-detail-header {
    font-size: 11px;
    font-weight: 600;
    color: var(--primary);
    padding: 4px 0;
    cursor: pointer;
    user-select: none;
  }

  .tool-detail-header:hover {
    color: #764ba2;
  }

  .tool-detail-arrow {
    display: inline-block;
    transition: transform 0.2s;
    font-size: 10px;
  }

  .tool-detail-arrow.open {
    transform: rotate(90deg);
  }

  .tool-io {
    background: var(--bg-light);
    padding: 10px;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 11px;
    margin: 4px 0 0 0;
    display: none;
    font-family: "Monaco", "Menlo", monospace;
    color: var(--text);
    border: 1px solid var(--border);
  }

  .tool-io.open {
    display: block;
  }

  .typing {
    align-self: flex-start;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 18px 18px 18px 4px;
  }

  .typing-dots {
    display: flex;
    gap: 4px;
  }

  .typing-dots span {
    width: 8px;
    height: 8px;
    background: var(--primary);
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out;
  }

  .typing-dots span:nth-child(1) { animation-delay: 0s; }
  .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
  .typing-dots span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }

  .typing-label {
    font-size: 13px;
    color: var(--text-secondary);
  }

  .input-bar {
    padding: 12px 16px;
    padding-bottom: max(12px, env(safe-area-inset-bottom));
    background: var(--surface);
    border-top: 1px solid var(--border);
    display: flex;
    gap: 10px;
    align-items: flex-end;
    flex-shrink: 0;
  }

  .input-wrapper {
    flex: 1;
    display: flex;
    align-items: flex-end;
    background: var(--bg-light);
    border: 1.5px solid var(--border);
    border-radius: 12px;
    transition: border-color 0.2s;
  }

  .input-wrapper:focus-within {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .input-wrapper textarea {
    flex: 1;
    border: none;
    background: transparent;
    padding: 10px 14px;
    font-size: 15px;
    color: var(--text);
    resize: none;
    max-height: 120px;
    min-height: 24px;
    line-height: 1.5;
    outline: none;
  }

  .input-wrapper textarea:disabled {
    opacity: 0.5;
  }

  .btn {
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: transform 0.15s;
  }

  .btn:active { transform: scale(0.92); }

  .btn-send {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  }

  .btn-send:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .btn-stop {
    background: #ef4444;
    color: white;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
  }

  @media (min-width: 768px) {
    .message.assistant {
      max-width: 85%;
    }

    .message {
      max-width: 75%;
    }
  }
</style>