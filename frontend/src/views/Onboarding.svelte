<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import Icon from '../lib/Icon.svelte';

  let { onComplete } = $props();

  let currentSlide = $state(0);
  let isAnimating = $state(false);
  let chatDemoMessages = $state([]);
  let chatDemoIndex = $state(0);
  let chatDemoInterval = $state(null);
  let chatDemoTimeout = $state(null);
  let currentTypingText = $state('');
  let showTypingIndicator = $state(false);
  let chatWindowEl = $state(null);
  let emailAnimPhase = $state(0);

  const slides = [
    {
      id: 'welcome',
      title: 'Welcome to Itinera',
      subtitle: 'Your AI-powered travel companion',
      description: 'Plan trips, create itineraries, and organize your travel details with the help of artificial intelligence.',
      icon: 'globe',
      color: '#667eea'
    },
    {
      id: 'chat',
      title: 'Chat with Your AI Assistant',
      subtitle: 'Natural conversation, powerful results',
      description: 'Simply tell Itinera where you want to go, and it will create a complete trip plan with accommodations, activities, and logistics.',
      icon: 'chat',
      color: '#764ba2',
      demo: 'chat'
    },
    {
      id: 'trips',
      title: 'Organized Trip Management',
      subtitle: 'All your adventures in one place',
      description: 'Each trip contains itinerary items that are tracked and saved. View your complete timeline, edit details, and keep everything organized.',
      icon: 'trips',
      color: '#667eea'
    },
    {
      id: 'email',
      title: 'Email Parsing Magic',
      subtitle: 'Forward confirmations, get itineraries',
      description: 'Forward your booking confirmation emails to info@itinera.ca. Our AI will automatically extract trip details and create itinerary items for you.',
      icon: 'review',
      color: '#764ba2',
      demo: 'email'
    },
    {
      id: 'complete',
      title: 'Ready to Explore?',
      subtitle: 'Start planning your next adventure',
      description: 'Try asking: "Plan a 5-day trip to Paris" or "Create an itinerary for Tokyo"',
      icon: 'send',
      color: '#667eea'
    }
  ];

  const chatDemoSequence = [
    { role: 'user', text: 'Plan a 3-day trip to Barcelona', delay: 0 },
    { role: 'assistant', text: "I'd love to help you plan a trip to Barcelona! Let me create a 3-day itinerary for you. First, let me search for some great accommodations and attractions.", delay: 2000, showTools: true },
    { role: 'assistant', text: "Perfect! I've created your 3-day Barcelona itinerary. Here's what I found:\n\n**Day 1: Gothic Quarter & Beach**\n• Morning: Explore the historic Gothic Quarter\n• Afternoon: Relax at Barceloneta Beach\n• Evening: Tapas tour in El Born\n\n**Day 2: Gaudí Architecture**\n• Morning: Visit Sagrada Família\n• Afternoon: Park Güell\n• Evening: Casa Batlló night tour\n\n**Day 3: Montserrat & Local Culture**\n• Morning: Day trip to Montserrat Monastery\n• Afternoon: La Boqueria market\n• Evening: Flamenco show\n\nI've saved this as a trip in your timeline. Would you like me to adjust anything?", delay: 6000 }
  ];

  let emailAnimTimer = $state(null);

  onMount(() => {
    startChatDemo();
    startEmailAnimation();
  });

  function clearChatTimers() {
    if (chatDemoInterval) {
      clearInterval(chatDemoInterval);
      chatDemoInterval = null;
    }
    if (chatDemoTimeout) {
      clearTimeout(chatDemoTimeout);
      chatDemoTimeout = null;
    }
  }

  onDestroy(() => {
    clearChatTimers();
    if (emailAnimTimer) {
      clearInterval(emailAnimTimer);
    }
  });

  function startEmailAnimation() {
    if (slides[currentSlide].demo !== 'email') return;
    emailAnimPhase = 0;
    emailAnimTimer = setInterval(() => {
      emailAnimPhase = (emailAnimPhase + 1) % 4;
    }, 1200);
  }

  function startChatDemo() {
    if (slides[currentSlide].demo !== 'chat') return;
    
    // Clear any running timers before starting fresh
    clearChatTimers();
    
    chatDemoMessages = [];
    chatDemoIndex = 0;
    showTypingIndicator = false;
    currentTypingText = '';
    
    chatDemoTimeout = setTimeout(() => {
      chatDemoTimeout = null;
      playNextChatMessage();
    }, 500);
  }

  async function scrollChatToBottom() {
    await tick();
    if (chatWindowEl) {
      chatWindowEl.scrollTop = chatWindowEl.scrollHeight;
    }
  }

  function scheduleNext(delay, fn) {
    chatDemoTimeout = setTimeout(() => {
      chatDemoTimeout = null;
      fn();
    }, delay);
  }

  function playNextChatMessage() {
    if (chatDemoIndex >= chatDemoSequence.length) {
      // Reset and loop
      scheduleNext(4000, () => {
        chatDemoMessages = [];
        chatDemoIndex = 0;
        showTypingIndicator = false;
        playNextChatMessage();
      });
      return;
    }

    const msg = chatDemoSequence[chatDemoIndex];
    
    if (msg.role === 'user') {
      chatDemoMessages = [...chatDemoMessages, { role: 'user', text: msg.text }];
      chatDemoIndex++;
      scrollChatToBottom();
      scheduleNext(1500, () => playNextChatMessage());
    } else {
      // Show typing indicator
      showTypingIndicator = true;
      scrollChatToBottom();
      
      scheduleNext(1500, () => {
        showTypingIndicator = false;
        typeText(msg.text, () => {
          chatDemoMessages = [...chatDemoMessages, { 
            role: 'assistant', 
            text: msg.text,
            showTools: msg.showTools 
          }];
          chatDemoIndex++;
          scrollChatToBottom();
          scheduleNext(3000, () => playNextChatMessage());
        });
      });
    }
  }

  function typeText(text, callback) {
    let index = 0;
    currentTypingText = '';
    
    chatDemoInterval = setInterval(() => {
      if (index < text.length) {
        currentTypingText += text[index];
        index++;
        scrollChatToBottom();
      } else {
        clearInterval(chatDemoInterval);
        chatDemoInterval = null;
        currentTypingText = '';
        callback();
      }
    }, 20); // 20ms per character for readable speed
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
    // Convert newlines to <br>
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
  }

  function nextSlide() {
    if (isAnimating || currentSlide >= slides.length - 1) return;
    isAnimating = true;
    currentSlide++;
    setTimeout(() => {
      isAnimating = false;
      if (slides[currentSlide].demo === 'chat') {
        startChatDemo();
      }
      if (slides[currentSlide].demo === 'email') {
        startEmailAnimation();
      }
    }, 300);
  }

  function prevSlide() {
    if (isAnimating || currentSlide <= 0) return;
    isAnimating = true;
    currentSlide--;
    setTimeout(() => {
      isAnimating = false;
      if (slides[currentSlide].demo === 'chat') {
        startChatDemo();
      }
      if (slides[currentSlide].demo === 'email') {
        startEmailAnimation();
      }
    }, 300);
  }

  function skipOnboarding() {
    completeOnboarding();
  }

  function completeOnboarding() {
    localStorage.setItem('itinera_onboarding_complete', 'true');
    if (onComplete) onComplete();
  }

  function handleKeydown(e) {
    if (e.key === 'ArrowRight') nextSlide();
    if (e.key === 'ArrowLeft') prevSlide();
    if (e.key === 'Escape') skipOnboarding();
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });

  let currentSlideData = $derived(slides[currentSlide]);
  let isLastSlide = $derived(currentSlide === slides.length - 1);
</script>

<div class="onboarding-overlay">
  <div class="onboarding-container">
    <!-- Close/Skip Button -->
    <button class="skip-btn" onclick={skipOnboarding} aria-label="Skip onboarding">
      Skip
    </button>

    <!-- Slide Content -->
    <div class="slide-wrapper" class:animating={isAnimating}>
      {#each slides as slide, index}
        <div class="slide" class:active={index === currentSlide}>
          {#if index === currentSlide}
            <div class="slide-content">
              <!-- Icon/Graphic -->
              <div class="slide-icon" style="background: linear-gradient(135deg, {slide.color}22, {slide.color}11)">
                <Icon name={slide.icon} size={64} style="color: {slide.color}" />
              </div>

              <!-- Chat Demo for Slide 2 -->
              {#if slide.demo === 'chat'}
                <div class="chat-demo">
                  <div class="chat-window" bind:this={chatWindowEl}>
                    <div class="chat-messages">
                      {#each chatDemoMessages as msg}
                        <div class="chat-message {msg.role}">
                          <div class="chat-bubble">
                            {#if msg.role === 'assistant'}
                              <div class="chat-label">Itinera</div>
                            {/if}
                            <div class="chat-text">{@html formatMarkdown(msg.text)}</div>
                          </div>
                        </div>
                      {/each}
                      
                      <!-- Typing Indicator -->
                      {#if showTypingIndicator}
                        <div class="chat-message assistant">
                          <div class="chat-bubble typing-bubble">
                            <div class="typing-dots">
                              <span></span><span></span><span></span>
                            </div>
                          </div>
                        </div>
                      {/if}
                      
                      <!-- Streaming Text -->
                      {#if currentTypingText}
                        <div class="chat-message assistant">
                          <div class="chat-bubble">
                            <div class="chat-label">Itinera</div>
                            <div class="chat-text">{@html formatMarkdown(currentTypingText)}</div>
                          </div>
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              {/if}

              <!-- Trip Visualization for Slide 3 -->
              {#if slide.id === 'trips'}
                <div class="trip-visual">
                  <div class="trip-hierarchy">
                    <div class="trip-card-mini">
                      <div class="trip-icon">🗺️</div>
                      <div class="trip-name">Barcelona Trip</div>
                    </div>
                    <div class="trip-items">
                      <div class="item-line"></div>
                      <div class="itinerary-item">
                        <div class="item-icon">🏨</div>
                        <div class="item-content">
                          <div class="item-title">Hotel Arts Barcelona</div>
                          <div class="item-meta">Check-in: Mar 15</div>
                        </div>
                      </div>
                      <div class="itinerary-item">
                        <div class="item-icon">🎨</div>
                        <div class="item-content">
                          <div class="item-title">Sagrada Família</div>
                          <div class="item-meta">Mar 16, 10:00 AM</div>
                        </div>
                      </div>
                      <div class="itinerary-item">
                        <div class="item-icon">🍽️</div>
                        <div class="item-content">
                          <div class="item-title">Tapas Tour</div>
                          <div class="item-meta">Mar 16, 7:00 PM</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              {/if}

              <!-- Email Visualization for Slide 4 -->
              {#if slide.id === 'email'}
                <div class="email-visual">
                  <div class="email-pipeline">
                    <!-- Step 1: Email Forwarding -->
                    <div class="pipeline-step" class:active={emailAnimPhase >= 0} class:done={emailAnimPhase > 0}>
                      <div class="step-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="2" y="4" width="20" height="16" rx="2"/>
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                        </svg>
                      </div>
                      <div class="step-content">
                        <div class="step-title">Forward Email</div>
                        <div class="step-detail">info@itinera.ca</div>
                      </div>
                    </div>

                    <!-- Animated Arrow -->
                    <div class="pipeline-connector" class:active={emailAnimPhase >= 1}>
                      <div class="connector-line"></div>
                      <div class="connector-dot" class:active={emailAnimPhase >= 1}></div>
                    </div>

                    <!-- Step 2: AI Parsing -->
                    <div class="pipeline-step" class:active={emailAnimPhase >= 1} class:done={emailAnimPhase > 1}>
                      <div class="step-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M12 2a4 4 0 0 1 4 4c0 2-2 3-2 5h-4c0-2-2-3-2-5a4 4 0 0 1 4-4Z"/>
                          <path d="M8 14h8"/>
                          <path d="M10 18h4"/>
                          <path d="M12 22v-4"/>
                        </svg>
                      </div>
                      <div class="step-content">
                        <div class="step-title">AI Parsing</div>
                        <div class="step-detail">Extracts dates, locations, confirmations</div>
                      </div>
                    </div>

                    <!-- Animated Arrow -->
                    <div class="pipeline-connector" class:active={emailAnimPhase >= 2}>
                      <div class="connector-line"></div>
                      <div class="connector-dot" class:active={emailAnimPhase >= 2}></div>
                    </div>

                    <!-- Step 3: Itinerary Created -->
                    <div class="pipeline-step" class:active={emailAnimPhase >= 2} class:done={emailAnimPhase >= 3}>
                      <div class="step-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                          <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                      </div>
                      <div class="step-content">
                        <div class="step-title">Itinerary Created</div>
                        <div class="step-detail">Added to your trip</div>
                      </div>
                    </div>
                  </div>

                  <div class="email-note">
                    <Icon name="check" size={16} />
                    <span>LLM parsing you can trust — if anything's unclear, it'll ask for clarification before saving</span>
                  </div>
                </div>
              {/if}

              <!-- Text Content -->
              <div class="slide-text">
                <h1 class="slide-title">{slide.title}</h1>
                <h2 class="slide-subtitle">{slide.subtitle}</h2>
                <p class="slide-description">{slide.description}</p>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Navigation -->
    <div class="navigation">
      <!-- Dots -->
      <div class="dots">
        {#each slides as _, index}
          <button 
            class="dot" 
            class:active={index === currentSlide}
            onclick={() => currentSlide = index}
            aria-label="Go to slide {index + 1}"
          ></button>
        {/each}
      </div>

      <!-- Buttons -->
      <div class="nav-buttons">
        {#if currentSlide > 0}
          <button class="nav-btn prev" onclick={prevSlide}>
            <Icon name="arrow-left" size={20} />
            Back
          </button>
        {/if}
        
        {#if isLastSlide}
          <button class="nav-btn next primary" onclick={completeOnboarding}>
            Get Started
          </button>
        {:else}
          <button class="nav-btn next" onclick={nextSlide}>
            Next
            <span class="next-arrow">→</span>
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .onboarding-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .onboarding-container {
    width: 100%;
    max-width: 600px;
    height: 100%;
    max-height: 800px;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .skip-btn {
    position: absolute;
    top: 0;
    right: 0;
    background: rgba(255, 255, 255, 0.15);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    z-index: 10;
    backdrop-filter: blur(10px);
  }

  .skip-btn:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .skip-btn:active {
    transform: scale(0.95);
  }

  .slide-wrapper {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .slide {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }

  .slide.active {
    opacity: 1;
    pointer-events: all;
  }

  .slide.animating {
    transition: opacity 0.3s ease;
  }

  .slide-content {
    width: 100%;
    max-width: 500px;
    padding: 20px;
    animation: slideIn 0.4s ease;
  }

  @keyframes slideIn {
    from { 
      opacity: 0;
      transform: translateY(20px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }

  .slide-icon {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 32px;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }

  .slide-text {
    text-align: center;
    color: white;
    margin-bottom: 24px;
  }

  .slide-title {
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 8px;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .slide-subtitle {
    font-size: 16px;
    font-weight: 500;
    opacity: 0.9;
    margin-bottom: 16px;
  }

  .slide-description {
    font-size: 15px;
    line-height: 1.6;
    opacity: 0.85;
    max-width: 400px;
    margin: 0 auto;
  }

  /* Chat Demo */
  .chat-demo {
    background: white;
    border-radius: 16px;
    padding: 16px;
    margin-bottom: 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    max-width: 400px;
    margin-left: auto;
    margin-right: auto;
  }

  .chat-window {
    background: #f8f9fa;
    border-radius: 12px;
    padding: 12px;
    min-height: 280px;
    max-height: 320px;
    overflow-y: auto;
    scroll-behavior: smooth;
  }

  .chat-messages {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .chat-message {
    animation: msgIn 0.3s ease;
  }

  @keyframes msgIn {
    from { 
      opacity: 0;
      transform: translateY(8px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }

  .chat-message.user {
    align-self: flex-end;
  }

  .chat-message.assistant {
    align-self: flex-start;
    width: 100%;
  }

  .chat-bubble {
    padding: 10px 14px;
    border-radius: 16px;
    font-size: 13px;
    line-height: 1.5;
    word-wrap: break-word;
  }

  .chat-message.user .chat-bubble {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 16px 16px 4px 16px;
    max-width: 85%;
    margin-left: auto;
  }

  .chat-message.assistant .chat-bubble {
    background: white;
    color: #1a1a1a;
    border-radius: 16px 16px 16px 4px;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .chat-label {
    font-size: 10px;
    font-weight: 700;
    color: #667eea;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .chat-text {
    white-space: pre-wrap;
  }

  .chat-text :global(strong) {
    font-weight: 700;
    color: #1a1a1a;
  }

  .typing-bubble {
    display: flex;
    align-items: center;
    padding: 12px 16px;
  }

  .typing-dots {
    display: flex;
    gap: 4px;
  }

  .typing-dots span {
    width: 8px;
    height: 8px;
    background: #667eea;
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

  /* Trip Visualization */
  .trip-visual {
    background: white;
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    max-width: 400px;
    margin-left: auto;
    margin-right: auto;
  }

  .trip-hierarchy {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .trip-card-mini {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
  }

  .trip-icon {
    font-size: 24px;
  }

  .trip-name {
    font-size: 16px;
    font-weight: 600;
  }

  .trip-items {
    position: relative;
    padding-left: 24px;
  }

  .item-line {
    position: absolute;
    left: 8px;
    top: 8px;
    bottom: 8px;
    width: 2px;
    background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
    opacity: 0.3;
  }

  .itinerary-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    background: #f8f9fa;
    border-radius: 8px;
    margin-bottom: 8px;
    border: 1px solid #e5e7eb;
  }

  .item-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .item-content {
    flex: 1;
    min-width: 0;
  }

  .item-title {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 2px;
  }

  .item-meta {
    font-size: 12px;
    color: #6b7280;
  }

  /* Email Visualization - Animated Pipeline */
  .email-visual {
    background: white;
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    max-width: 400px;
    margin-left: auto;
    margin-right: auto;
    position: relative;
    overflow: hidden;
  }

  .email-pipeline {
    display: flex;
    flex-direction: column;
    gap: 0;
    position: relative;
    z-index: 1;
  }

  .pipeline-step {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    background: #f8f9fa;
    border-radius: 10px;
    border: 1.5px solid #e5e7eb;
    transition: all 0.4s ease;
    opacity: 0.5;
    transform: scale(0.95);
  }

  .pipeline-step.active {
    opacity: 1;
    transform: scale(1);
    border-color: #667eea;
    background: #eef0ff;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.15);
  }

  .pipeline-step.done {
    opacity: 1;
    transform: scale(1);
    border-color: #16a34a;
    background: #f0fdf4;
  }

  .step-icon {
    font-size: 28px;
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4b5563;
  }

  .pipeline-step.active .step-icon {
    color: #667eea;
  }

  .pipeline-step.done .step-icon {
    color: #16a34a;
  }

  .step-content {
    flex: 1;
    min-width: 0;
  }

  .step-title {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 2px;
  }

  .step-detail {
    font-size: 12px;
    color: #6b7280;
    line-height: 1.3;
  }

  .pipeline-connector {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 32px;
    position: relative;
  }

  .connector-line {
    width: 2px;
    height: 100%;
    background: #e5e7eb;
    transition: background 0.4s ease;
  }

  .pipeline-connector.active .connector-line {
    background: #667eea;
  }

  .connector-dot {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #e5e7eb;
    transition: all 0.4s ease;
  }

  .connector-dot.active {
    background: #667eea;
    box-shadow: 0 0 8px rgba(102, 126, 234, 0.5);
    animation: dotPulse 1s ease-in-out infinite;
  }

  @keyframes dotPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.3); }
  }

  /* Flowing email animation */
  .email-note {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: #f0fdf4;
    border-radius: 8px;
    font-size: 12px;
    color: #166534;
    line-height: 1.4;
    margin-top: 16px;
    position: relative;
    z-index: 1;
    border: 1px solid #bbf7d0;
  }

  .email-note :global(svg) {
    flex-shrink: 0;
    color: #16a34a;
  }

  /* Navigation */
  .navigation {
    padding: 20px 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: center;
  }

  .dots {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.4);
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    padding: 0;
  }

  .dot.active {
    background: white;
    width: 24px;
    border-radius: 4px;
  }

  .dot:hover {
    background: rgba(255, 255, 255, 0.7);
  }

  .nav-buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
    width: 100%;
  }

  .nav-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border-radius: 24px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    background: rgba(255, 255, 255, 0.15);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .nav-btn:hover {
    background: rgba(255, 255, 255, 0.25);
    transform: translateY(-1px);
  }

  .nav-btn:active {
    transform: translateY(0) scale(0.98);
  }

  .nav-btn.primary {
    background: white;
    color: #667eea;
    border-color: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .nav-btn.primary:hover {
    background: #f8f9fa;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }

  .next-arrow {
    font-size: 18px;
    line-height: 1;
  }

  .nav-btn.prev {
    order: 1;
  }

  .nav-btn.next {
    order: 2;
  }

  /* Mobile Responsive */
  @media (max-width: 640px) {
    .onboarding-container {
      max-height: 100vh;
    }

    .slide-content {
      padding: 16px;
    }

    .slide-icon {
      width: 100px;
      height: 100px;
      margin-bottom: 24px;
    }

    .slide-icon :global(svg) {
      width: 48px;
      height: 48px;
    }

    .slide-title {
      font-size: 24px;
    }

    .slide-subtitle {
      font-size: 14px;
    }

    .slide-description {
      font-size: 14px;
    }

    .chat-demo {
      padding: 12px;
      margin-bottom: 20px;
    }

    .chat-window {
      min-height: 240px;
      max-height: 280px;
    }

    .trip-visual,
    .email-visual {
      padding: 16px;
      margin-bottom: 20px;
    }

    .nav-btn {
      padding: 10px 20px;
      font-size: 14px;
    }

    .skip-btn {
      top: 12px;
      right: 12px;
    }
  }

  @media (min-width: 768px) {
    .slide-title {
      font-size: 32px;
    }

    .slide-subtitle {
      font-size: 18px;
    }

    .slide-description {
      font-size: 16px;
    }

    .chat-demo,
    .trip-visual,
    .email-visual {
      padding: 24px;
    }

    .chat-window {
      min-height: 300px;
      max-height: 360px;
    }
  }
</style>