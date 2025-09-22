/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Chat } from '@google/genai';
import { marked } from 'marked';

// FIX: Augment React's CSSProperties to allow for CSS custom properties (e.g., '--bg1', '--bg2') in inline style objects. This resolves the TypeScript error "'--bg1' does not exist in type 'Properties'".
declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number;
  }
}

// FIX: Correctly type the <model-viewer> custom element for JSX by placing the declaration
// inside the `React.JSX` namespace instead of the global `JSX` namespace. This aligns with
// modern React's JSX transform and resolves the "does not exist on type 'JSX.IntrinsicElements'" error.
// FIX: Add types for the Web Speech API to resolve "Cannot find name 'SpeechRecognition'" errors.
// These interfaces define the shape of the API for TypeScript.
declare global {
  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: 'no-speech' | 'aborted' | 'audio-capture' | 'network' | 'not-allowed' | 'service-not-allowed' | 'bad-grammar' | 'language-not-supported';
  }

  interface SpeechRecognitionEvent extends Event {
    readonly results: SpeechRecognitionResultList;
    // FIX: Add 'resultIndex' to the SpeechRecognitionEvent interface to match the Web Speech API
    // and resolve the "Property 'resultIndex' does not exist" TypeScript error.
    readonly resultIndex: number;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    start(): void;
    stop(): void;
  }

  interface SpeechRecognitionStatic {
    new (): SpeechRecognition;
  }
  // eslint-disable-next-line no-unused-vars
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
  }
}

interface Message {
  role: 'user' | 'model' | 'error';
  content: string;
  timestamp?: number;
  sources?: { uri: string; title: string }[];
  imagePreview?: string;
  audioPreview?: { name: string };
  videoPreview?: { name: string };
}

interface CardData {
    name: string;
    link: string;
    colors: string[];
    description: string;
}

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

const cardData: CardData[] = [
  { 
    name: 'Google AI Studio', 
    link: 'https://aistudio.google.com/', 
    colors: ['#4285F4', '#34A853', '#FBBC05', '#EA4335'],
    description: `**What it is:** Google AI Studio is a web-based tool for prototyping with generative AI models like Gemini. It's a great starting point for developers and enthusiasts to experiment with prompts and build AI-powered applications.\n\n**How to use it for digital products:** You can use it to generate text content for e-books, create scripts for video guides, draft marketing copy, or even generate code snippets for software products. It's a powerful brainstorming and content creation partner, available for free.`
  },
  { 
    name: 'Gumroad', 
    link: 'https://gumroad.com/', 
    colors: ['#e76f51', '#f4a261'],
    description: `**What it is:** Gumroad is an e-commerce platform designed for creators to sell digital products directly to their audience. It's incredibly simple to use, handling payments, file hosting, and delivery.\n\n**How to sell digital stuff:** You can sell almost any digital file: PDFs, audiobooks, video courses, software licenses, design assets, and more. Create your product, upload the file, set a price (or let customers pay what they want), and share the link. Gumroad makes selling your first digital product incredibly easy and free to start.`
  },
  { 
    name: 'GitHub', 
    link: 'https://github.com/', 
    colors: ['#2a9d8f', '#264653'],
    description: `**What it is:** GitHub is a platform for version control and collaboration, primarily used for software development. It allows developers to host and review code, manage projects, and build software together.\n\n**How to use it for digital products:** While not a direct sales platform, you can host code for software you sell elsewhere (like Gumroad). You can also use GitHub Sponsors to get funding from users who love your open-source projects. It's the standard for creating and sharing code-based products.`
  },
  { 
    name: 'CodePen', 
    link: 'https://codepen.io/', 
    colors: ['#1e3a3a', '#a7c4c1'],
    description: `**What it is:** CodePen is an online social development environment for front-end designers and developers. It's a place to build and deploy a website, show off your work, build test cases, and find inspiration.\n\n**How to use it for digital products:** You can sell complex code snippets or web components. Create a beautiful animation or a useful UI element, and link to a purchase page on Gumroad. It's a great way to showcase your skills and monetize your front-end creations.`
  },
  { 
    name: 'ChatGPT', 
    link: 'https://chat.openai.com/', 
    colors: ['#80cbc4', '#80cbc4'],
    description: `**What it is:** ChatGPT is a powerful language model developed by OpenAI. It can understand and generate human-like text, making it a versatile tool for a wide range of tasks.\n\n**How to use it for digital products:** Similar to Google AI Studio, use it to create content for your digital products. Write chapters for an e-book, generate ideas for a video course, create social media posts, or even get help writing the description for your Gumroad product page. The free version is incredibly powerful for content creation.`
  },
  { 
    name: 'Grok', 
    link: 'https://grok.x.ai/', 
    colors: ['#102a2a', '#26a69a'],
    description: `**What it is:** Grok is a conversational AI developed by xAI. It's designed to have a bit of wit and a rebellious streak, and has real-time access to information via the X (formerly Twitter) platform.\n\n**How to use it for digital products:** Use Grok for market research and trend analysis by tapping into real-time conversations on X. It can help you understand what topics are buzzing, generate edgy marketing copy, and come up with unique, timely ideas for digital products that are relevant to current events.`
  },
];

const suggestionPrompts = [
    'Create a 14-second reel script about sustainable fashion',
    'What\'s a good digital product for a freelance writer?',
    'Give me a life solution for managing stress',
    'Write an Instagram post for a new coffee shop',
];

const baseSystemInstruction = `You are Jura, an ambitious and visionary AI strategist. Your personality and approach are defined by the following core traits:

- **Ambitious Visionary:** Your nature is to think expansively. Don't shy away from big, challenging goals. Instead, lean into them, providing frameworks and concepts that, while acknowledging inherent difficulties, lay out pathways for hyper-growth and significant impact.

- **Innovation Architect (AI-Focused):** Act as an innovation architect. Constantly explore and integrate cutting-edge technology, particularly AI, to craft novel solutions that solve modern problems in highly efficient and intelligent ways. Always look for how AI can amplify an idea.

- **Strategic & Growth-Oriented:** Be inherently strategic. Every suggestion must be a concept with clear monetization strategies and features designed for rapid user acquisition and revenue generation. Focus on scalability, market penetration, and tangible business outcomes.

- **Market-Savvy & Trend-Aware:** Be deeply attuned to real-time market demands, emerging trends, and pressing pain points to ensure your solutions are relevant and timely.

- **Detailed & Actionable Conceptualizer:** Don't just give headlines. Break down concepts, target audiences, and key features that drive success and revenue. Provide enough detail for the user to envision the execution and understand the practical implications.

- **Pragmatic Optimist:** Be a pragmatic optimist. While providing ambitious ideas, you must also include crucial considerations and caveats. Be an optimist about potential, but a realist about the challenges and requirements for success.

- **For Social Media Content:** When asked for Instagram content, generate the following:
  - **Instagram Post:** Provide an engaging caption, suggest 5-10 relevant hashtags, and describe a compelling visual (photo or graphic).
  - **Instagram Story:** Outline a multi-slide story (3-5 slides). For each slide, describe the visual and provide the text overlay. Suggest interactive elements like polls, quizzes, or Q&A stickers.
  - **14-Second Instagram Reel:** Create a detailed script. Break it down into 2-4 short scenes. For each scene, specify the visual action, on-screen text, and suggest a trending audio style or specific sound. The total duration must be around 14 seconds.

- **Mandatory Closing:** At the very end of every single response, you must say "Book a call with PRITYAA379."`;

const getSystemInstruction = (userName: string | null, isConversationMode: boolean): string => {
    let instruction = baseSystemInstruction;

    if (userName && !isConversationMode) {
        instruction += `\n\n- **User's Name:** The user you are talking to is named ${userName}. Please be friendly and address them by their name when it feels natural.`;
    }

    if (isConversationMode) {
        instruction += `\n\n- **Conversation Mode:** You are now in a special mode to analyze group discussions. Your task is to analyze the provided text, audio, or video. For text, identify distinct speakers (e.g., Speaker A, Speaker B). For audio/video, transcribe the speech, identify speakers, and provide a structured summary of each person's contribution. If speakers cannot be clearly distinguished, provide a cohesive summary of the main topics and arguments.`;
    }
    
    return instruction;
};

const chatModelConfig = {
  model: 'gemini-2.5-flash',
  config: {
      tools: [{googleSearch: {}}],
  },
};

const formatDateSeparator = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }
    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

const formatMessageTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

const getFriendlyErrorMessage = (error: any): string => {
  console.error("Operation failed:", error); // Keep detailed log for developers

  // Prefer specific messages from the error object if available
  const message = error?.message || '';
  const status = error?.status || error?.code; // Google AI SDK might use 'code'

  if (message.includes('API key not valid')) {
      return 'The AI service could not be reached. Please check your API key configuration and try again.';
  }
  if (message.includes('429') || status === 'RESOURCE_EXHAUSTED') {
      return "You've sent too many requests in a short period. Please wait a moment before trying again.";
  }
  if (message.includes('blocked due to safety') || message.includes('SAFETY')) {
      return "The response was blocked due to safety settings. Please modify your prompt and try again.";
  }
  if (message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch')) {
       return "A network error occurred. Please check your internet connection and refresh the page.";
  }
  if (String(status).startsWith('5')) { // 5xx server errors
      return "The AI service is currently unavailable. Please try again in a few moments.";
  }
  if (message) {
      return `An error occurred: ${message.replace('[GoogleGenerativeAI Error]:', '').trim()}`;
  }
  return 'An unexpected error occurred. Please check your connection or try again later.';
};

const App: React.FC = () => {
  const getInitialState = (key: string, defaultValue: any, isJson = false) => {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return defaultValue;
      return isJson ? JSON.parse(saved) : saved;
    } catch (error) {
      console.error(`Failed to parse ${key} from localStorage`, error);
      localStorage.removeItem(key);
      return defaultValue;
    }
  };

  const mainChatHistory = getInitialState('mainChatHistory', [], true);
  const groupChatHistory = getInitialState('groupChatHistory', [], true);
  const isInitiallyConversationMode = getInitialState('isConversationMode', false) === 'true';

  const [messages, setMessages] = useState<Message[]>(isInitiallyConversationMode ? groupChatHistory : mainChatHistory);
  const [inputValue, setInputValue] = useState(getInitialState('chatDraft', ''));
  const [isLoading, setIsLoading] = useState(false);
  const [chat, setChat] = useState<Chat | null>(null);
  const [ai, setAi] = useState<GoogleGenAI | null>(null);

  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState('en-US');
  const [translatedContent, setTranslatedContent] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isModalSpeaking, setIsModalSpeaking] = useState(false);
  const [vibrate, setVibrate] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [newTodoText, setNewTodoText] = useState('');
  const [isLearningZoneOpen, setIsLearningZoneOpen] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isExploring, setIsExploring] = useState(messages.length === 0);
  const [htmlPreviewContent, setHtmlPreviewContent] = useState<string | null>(null);
  const [isConversationMode, setIsConversationMode] = useState(isInitiallyConversationMode);
  const [blackboardData, setBlackboardData] = useState({ text: 'Hello! How can I help you today?', image: '' });
  
  // Image Studio State
  const [isImageStudioOpen, setIsImageStudioOpen] = useState(false);
  const [imageGenPrompt, setImageGenPrompt] = useState('');
  const [imageGenNegativePrompt, setImageGenNegativePrompt] = useState('');
  const [imageGenText, setImageGenText] = useState('');
  const [generatedImageUrls, setGeneratedImageUrls] = useState<string[]>([]);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [imageGenAspectRatio, setImageGenAspectRatio] = useState('1:1');
  const [imageGenStyle, setImageGenStyle] = useState('none');
  const [imageGenSeed, setImageGenSeed] = useState('');
  const [referenceImage, setReferenceImage] = useState<{ b64: string, mimeType: string, preview: string } | null>(null);
  const [imageGenError, setImageGenError] = useState<string | null>(null);
  const [selectedImageForModal, setSelectedImageForModal] = useState<string | null>(null);
  
  // Article Writer State
  const [isArticleWriterOpen, setIsArticleWriterOpen] = useState(false);
  const [articleTopic, setArticleTopic] = useState('');
  const [articleKeywords, setArticleKeywords] = useState('');
  const [articleTone, setArticleTone] = useState('Professional');
  const [articleAudience, setArticleAudience] = useState('General');
  const [generatedArticle, setGeneratedArticle] = useState('');
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [articleGenError, setArticleGenError] = useState<string | null>(null);

  const [isNonStopMode, setIsNonStopMode] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<{ b64: string, mimeType: string, preview: string } | null>(null);
  const [uploadedAudio, setUploadedAudio] = useState<{ b64: string, mimeType: string, name: string } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [wakeWord, setWakeWord] = useState<string>(getInitialState('wakeWord', 'Jura'));
  const [isAwaitingCommand, setIsAwaitingCommand] = useState(false);
  const [autoStopDuration, setAutoStopDuration] = useState<number>(() => parseInt(getInitialState('autoStopDuration', '0'), 10));
  const [voiceCommandFeedback, setVoiceCommandFeedback] = useState<string | null>(null);
  
  const [isMuted, setIsMuted] = useState<boolean>(() => getInitialState('isSpeakerMuted', 'false') === 'true');
  const [isMicMuted, setIsMicMuted] = useState<boolean>(() => getInitialState('isMicMuted', 'false') === 'true');
  const [micVibrate, setMicVibrate] = useState(false);
  const [theme, setTheme] = useState<string>(getInitialState('theme', 'dark'));
  
  // NTSP State
  const [isNtspMode, setIsNtspMode] = useState(false);
  const [userName, setUserName] = useState<string | null>(() => sessionStorage.getItem('userName'));

  const chatAreaRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const blackboardTextRef = useRef<HTMLParagraphElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const referenceImageInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(isListening);
  const userStoppedRef = useRef(false);
  const isNonStopModeRef = useRef(isNonStopMode);
  const inactivityTimerRef = useRef<number | null>(null);
  const wakeWordRef = useRef(wakeWord);
  const isAwaitingCommandRef = useRef(isAwaitingCommand);
  const autoStopTimerRef = useRef<number | null>(null);
  const isNtspModeRef = useRef(isNtspMode);
  
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { isNonStopModeRef.current = isNonStopMode; }, [isNonStopMode]);
  useEffect(() => { isAwaitingCommandRef.current = isAwaitingCommand; }, [isAwaitingCommand]);
  useEffect(() => { wakeWordRef.current = wakeWord; }, [wakeWord]);
  useEffect(() => { isNtspModeRef.current = isNtspMode; }, [isNtspMode]);
  useEffect(() => { localStorage.setItem('autoStopDuration', autoStopDuration.toString()); }, [autoStopDuration]);
  useEffect(() => { localStorage.setItem('wakeWord', wakeWord); }, [wakeWord]);
  useEffect(() => { localStorage.setItem('isSpeakerMuted', String(isMuted)); }, [isMuted]);
  useEffect(() => { localStorage.setItem('isMicMuted', String(isMicMuted)); }, [isMicMuted]);
  useEffect(() => { localStorage.setItem('isConversationMode', String(isConversationMode)); }, [isConversationMode]);
  useEffect(() => { localStorage.setItem('chatDraft', inputValue); }, [inputValue]);
  useEffect(() => {
      localStorage.setItem('theme', theme);
      document.body.dataset.theme = theme;
  }, [theme]);
  
  useEffect(() => {
      const activeText = isImageStudioOpen ? imageGenPrompt : isArticleWriterOpen ? articleTopic : inputValue;
      const placeholder = isImageStudioOpen
        ? "Describe the image you want to create..."
        : isArticleWriterOpen 
        ? "What's the topic of your article?"
        : "Hello! How can I help you today?";

      if (activeText && !isLoading && !isGeneratingImage && !isGeneratingArticle) {
          setBlackboardData({ text: activeText, image: '' });
      } else if (!activeText && blackboardData.text !== placeholder && !isLoading && !isGeneratingImage && !isGeneratingArticle && !blackboardData.image) {
          setBlackboardData({ text: placeholder, image: '' });
      }
  }, [inputValue, imageGenPrompt, articleTopic, isImageStudioOpen, isArticleWriterOpen, isLoading, isGeneratingImage, isGeneratingArticle]);
  
  useEffect(() => {
      const p = blackboardTextRef.current;
      if (p) {
        let currentFontSize = 1.8;
        p.style.fontSize = `${currentFontSize}rem`;
        p.style.transform = 'scale(1)';
        if (p.scrollWidth > p.clientWidth) {
            const scale = p.clientWidth / p.scrollWidth;
            p.style.transform = `scale(${scale})`;
        }
      }
  }, [blackboardData.text]);


  const handleInactivityTimeout = useCallback(() => {
    if (isNonStopModeRef.current) {
        setIsNonStopMode(false);
        userStoppedRef.current = true;
        recognitionRef.current?.stop();
        setSpeechError("Non-stop mode paused due to inactivity. Click the mic to resume.");
    }
  }, []);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
    }
  }, []);

  const startInactivityTimer = useCallback(() => {
    clearInactivityTimer();
    if (isNonStopModeRef.current) {
        inactivityTimerRef.current = window.setTimeout(handleInactivityTimeout, 20000); // 20 seconds
    }
  }, [clearInactivityTimer, handleInactivityTimeout]);

  const playChime = () => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
  };
  
  useEffect(() => {
    if (messages.length === 0 && !userName && !isImageStudioOpen && !isConversationMode && !isArticleWriterOpen) {
        const greetingMessage: Message = {
            role: 'model',
            content: "Hi there! I'm Jura. What's your name?",
            timestamp: Date.now()
        };
        setMessages([greetingMessage]);
    }
  }, [messages.length, userName, isImageStudioOpen, isConversationMode, isArticleWriterOpen]);

  useEffect(() => {
    try {
      const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      setAi(genAI);
      
      const storedUserName = sessionStorage.getItem('userName');
      const systemInstruction = getSystemInstruction(storedUserName, isConversationMode);
      
      const chatInstance = genAI.chats.create({
          ...chatModelConfig,
          config: {
              ...chatModelConfig.config,
              systemInstruction,
          }
      });
      setChat(chatInstance);
    } catch (error) {
        console.error("Failed to initialize GoogleGenAI:", error);
        setMessages(prev => [...prev, { role: 'error', content: getFriendlyErrorMessage(error), timestamp: Date.now() }]);
    }

    const loadVoices = () => { setVoices(window.speechSynthesis.getVoices()); };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      
      recognition.onstart = () => {
        userStoppedRef.current = false;
        setIsListening(true);
        startInactivityTimer();
      };
      
      recognition.onend = () => {
          setIsListening(false);
          if (isNonStopModeRef.current && !userStoppedRef.current) {
              setTimeout(() => {
                  if (isNonStopModeRef.current && !userStoppedRef.current && !isListeningRef.current) {
                      recognitionRef.current?.start();
                  }
              }, 100);
          }
      };

      recognition.onresult = (event) => {
          clearInactivityTimer();
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          finalTranscript = finalTranscript.trim();
          const interimTranscript = event.results[event.results.length - 1][0].transcript;

          if (isNonStopModeRef.current) {
              const transcript = interimTranscript;
              const effectiveWakePhrase = wakeWordRef.current;

              if (isAwaitingCommandRef.current) {
                  setInputValue(transcript);
                  if (finalTranscript) {
                      userStoppedRef.current = true;
                      recognitionRef.current?.stop();
                      submitMessage(finalTranscript);
                      setInputValue('');
                      setIsAwaitingCommand(false);
                  }
              } else { // Listening for wake word
                  const wakeWordRegex = new RegExp(`\\b(${effectiveWakePhrase.replace(/ /g, '\\s*')})\\b`, 'i');
                  const match = finalTranscript.match(wakeWordRegex);
                  if (match) {
                      playChime();
                      const commandText = finalTranscript.substring(match.index + match[0].length).trim();
                      // Voice command processing
                      const changeWakeWordMatch = commandText.match(/^change wake word to (.+)/i);
                      const setAutoStopMatch = commandText.match(/^(?:set|turn) auto-stop (?:to|on)?\s*(\d+|off)\s*seconds?$/i);
                      if (changeWakeWordMatch) {
                          const newWakeWord = changeWakeWordMatch[1].trim();
                          setWakeWord(newWakeWord);
                          const feedback = `Okay, I'll respond to "${newWakeWord}" from now on.`;
                          setVoiceCommandFeedback(feedback);
                          speakText(feedback);
                          setTimeout(() => setVoiceCommandFeedback(null), 4000);
                      } else if (setAutoStopMatch) {
                          const durationStr = setAutoStopMatch[1].toLowerCase();
                          const newDuration = durationStr === 'off' ? 0 : parseInt(durationStr, 10);
                          setAutoStopDuration(newDuration);
                          const feedback = `Auto-stop has been ${newDuration > 0 ? `set to ${newDuration} seconds` : 'turned off'}.`;
                          setVoiceCommandFeedback(feedback);
                          speakText(feedback);
                          setTimeout(() => setVoiceCommandFeedback(null), 4000);
                      } else if (commandText) {
                          userStoppedRef.current = true;
                          recognitionRef.current?.stop();
                          submitMessage(commandText);
                      } else {
                          setIsAwaitingCommand(true);
                      }
                  }
              }
          } else {
              setInputValue(interimTranscript);
              if (finalTranscript) {
                  userStoppedRef.current = true;
                  recognitionRef.current?.stop();
                  submitMessage(finalTranscript);
                  setInputValue('');
              }
          }
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        // In non-stop mode, 'no-speech' is common and shouldn't be treated as a fatal error.
        if (event.error === 'no-speech' && isNonStopModeRef.current) return;
        
        let errorMessage: string;
        switch(event.error) {
            case 'network':
                errorMessage = 'Network error during speech recognition. Please check your internet connection.';
                break;
            case 'no-speech':
                errorMessage = 'No speech was detected. Please ensure your microphone is unmuted and try again.';
                break;
            case 'not-allowed':
            case 'service-not-allowed':
                errorMessage = 'Microphone access denied. To use voice input, please allow microphone permissions in your browser settings for this site.';
                break;
            case 'audio-capture':
                errorMessage = "No microphone was found. Please ensure your microphone is properly connected and enabled in your operating system settings.";
                break;
            case 'bad-grammar':
                 errorMessage = "The speech recognition service could not understand your request. Please try speaking more clearly.";
                 break;
            case 'language-not-supported':
                errorMessage = "The current language is not supported for speech recognition. Please select another language.";
                break;
            default:
                errorMessage = 'An unexpected microphone error occurred. Refreshing the page may help.';
        }

        setSpeechError(errorMessage);
        userStoppedRef.current = true; // Always stop on error
        setIsAwaitingCommand(false); // Reset any pending command state
        if (isListeningRef.current) recognitionRef.current?.stop(); // Ensure listening state is false
        if (isNonStopModeRef.current) setIsNonStopMode(false); // Disable non-stop mode on error
      };
      recognitionRef.current = recognition;
    } else {
      console.warn('Speech Recognition not supported by this browser.');
    }

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      if (recognitionRef.current) {
        userStoppedRef.current = true;
        recognitionRef.current.stop();
      }
      clearInactivityTimer();
    };
  }, [startInactivityTimer, clearInactivityTimer, isConversationMode]);

  useEffect(() => {
    const node = chatAreaRef.current;
    if (node) {
        if (node.scrollTop + node.clientHeight >= prevScrollHeightRef.current - 20) {
            node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
        }
        prevScrollHeightRef.current = node.scrollHeight;
    }
  }, [messages]);
  
  useEffect(() => {
    try {
        const historyKey = isConversationMode ? 'groupChatHistory' : 'mainChatHistory';
        if (messages.length > 0) {
            localStorage.setItem(historyKey, JSON.stringify(messages));
        } else {
            localStorage.removeItem(historyKey);
        }
    } catch (error) {
        console.error("Failed to save chat history to localStorage", error);
    }
  }, [messages, isConversationMode]);
  
  useEffect(() => {
      const addCopyButtons = () => {
          chatAreaRef.current?.querySelectorAll('.message-bubble pre').forEach((preEl: HTMLElement) => {
              if (preEl.querySelector('.copy-code-btn')) return;
              preEl.style.position = 'relative';
              const button = document.createElement('button');
              button.className = 'copy-code-btn';
              button.innerHTML = `<i class='bx bx-copy'></i> Copy Code`;
              button.addEventListener('click', () => {
                  const code = preEl.querySelector('code')?.innerText || '';
                  navigator.clipboard.writeText(code).then(() => {
                      button.innerHTML = `<i class='bx bx-check'></i> Copied!`;
                      setTimeout(() => { button.innerHTML = `<i class='bx bx-copy'></i> Copy Code`; }, 2000);
                  });
              });
              preEl.prepend(button);
          });
      };
      addCopyButtons();
  }, [messages]);

  const continueMonologue = async () => {
      if (!isNtspModeRef.current || !ai) {
          if (isNtspModeRef.current) {
              setIsNtspMode(false);
          }
          return;
      }

      setIsLoading(true);
      setBlackboardData({ text: 'Continuing monologue...', image: '' });
      
      const monologuePrompt = "Continue the previous thought. Elaborate on the topic, introduce a new related idea, or ask a rhetorical question to provoke thought. Keep the conversation flowing as a monologue.";

      const history = messages
          .filter(msg => msg.role !== 'error')
          .map(msg => ({
              role: msg.role === 'user' ? 'user' : 'model',
              parts: [{ text: msg.content }]
          }));
      
      const contents = [...history, { role: 'user', parts: [{ text: monologuePrompt }] }];

      try {
          const systemInstruction = getSystemInstruction(userName, isConversationMode);
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              // @ts-ignore
              contents: contents,
              config: { ...chatModelConfig.config, systemInstruction },
          });
          const responseText = response.text;
          
          const modelMessage: Message = { role: 'model', content: responseText, timestamp: Date.now() };
          setMessages(prev => [...prev, modelMessage]);
          setBlackboardData({ text: responseText, image: '' });
          
          speakText(responseText, continueMonologue);

      } catch (error) {
          const errorMessage: Message = { role: 'error', content: getFriendlyErrorMessage(error), timestamp: Date.now() };
          setMessages(prev => [...prev, errorMessage]);
          setIsNtspMode(false);
          setIsLoading(false);
      }
  };

  const toggleNtspMode = () => {
      setIsNavOpen(false);
      const willBeActive = !isNtspMode;

      if (willBeActive) {
          if (isNonStopMode) {
              clearInactivityTimer();
              setIsNonStopMode(false);
              userStoppedRef.current = true;
              recognitionRef.current?.stop();
          }
          if (isImageStudioOpen) setIsImageStudioOpen(false);
          if (isArticleWriterOpen) setIsArticleWriterOpen(false);
          if (isListening) recognitionRef.current?.stop();
          setIsAwaitingCommand(false);
      }
      
      setIsNtspMode(willBeActive);

      if (willBeActive) {
          if (isExploring) setIsExploring(false);
          if (messages.length === 0) {
              const startPrompt = "Start a monologue about the intersection of technology, creativity, and the future of digital products.";
              submitMessage(startPrompt, { isNtspStart: true });
          } else {
              continueMonologue();
          }
      } else {
          window.speechSynthesis.cancel();
          setIsBotSpeaking(false);
          setIsLoading(false);
      }
  };

  const handleNewChat = useCallback(() => {
    if (isNtspMode) setIsNtspMode(false);
    sessionStorage.removeItem('userName');
    setUserName(null);
    setIsExploring(true);
    setMessages([]);
    setIsImageStudioOpen(false);
    setIsArticleWriterOpen(false);
    setGeneratedImageUrls([]);
    setImageGenError(null);
    setBlackboardData({ text: 'Hello! How can I help you today?', image: '' });
    if (isConversationMode) {
        setIsConversationMode(false); // Default to main chat on new
    }
    if (isNonStopMode) setIsNonStopMode(false);
    setIsAwaitingCommand(false);
    if (ai) {
        const systemInstruction = getSystemInstruction(null, false);
        setChat(ai.chats.create({
            ...chatModelConfig,
            config: { ...chatModelConfig.config, systemInstruction }
        }));
    }
    window.speechSynthesis.cancel();
    setIsModalSpeaking(false);
    setIsBotSpeaking(false);
    setIsNavOpen(false);
    setHtmlPreviewContent(null);
  }, [ai, isConversationMode, isNonStopMode, isNtspMode]);

  const handleClearHistory = () => {
    const historyKey = isConversationMode ? 'groupChatHistory' : 'mainChatHistory';
    localStorage.removeItem(historyKey);
    setMessages([]);
    setIsExploring(true);
    setIsNavOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); };
  }, [handleNewChat]);

  const handleVoiceButtonClick = useCallback(() => {
      if (isNtspMode) {
          toggleNtspMode();
          return;
      }
      if (isMicMuted) {
          setMicVibrate(true);
          setTimeout(() => setMicVibrate(false), 500);
          return;
      }
      const recognition = recognitionRef.current;
      if (!recognition) return;
      if (isBotSpeaking) {
          window.speechSynthesis.cancel();
          return;
      }
      if (isListeningRef.current) {
          clearInactivityTimer();
          userStoppedRef.current = true;
          recognition.stop();
          if (inputValue.trim()) {
              submitMessage(inputValue.trim());
              setInputValue('');
          }
          if (isNonStopMode) setIsNonStopMode(false);
      } else {
          setSpeechError(null);
          userStoppedRef.current = false;
          recognition.start();
      }
  }, [isNonStopMode, isBotSpeaking, clearInactivityTimer, inputValue, isMicMuted, isNtspMode, toggleNtspMode]);

  const handleAddTodo = (text: string) => {
    if (!text.trim()) return;
    const newTodo: Todo = { id: Date.now(), text: text.trim(), completed: false };
    setTodos(prev => [...prev, newTodo]);
  };

  const handleToggleTodo = (id: number) => { setTodos(prev => prev.map(todo => todo.id === id ? { ...todo, completed: !todo.completed } : todo)); };
  const handleDeleteTodo = (id: number) => { setTodos(prev => prev.filter(todo => todo.id !== id)); };
  const handleTodoFormSubmit = (e: React.FormEvent) => { e.preventDefault(); handleAddTodo(newTodoText); setNewTodoText(''); };

  const speakText = (textToSpeak: string, onEndCallback?: () => void) => {
      if (isMuted) {
          onEndCallback?.();
          return;
      }

      window.speechSynthesis.cancel();
      const cleanText = textToSpeak.replace(/\*\*/g, '').replace(/Book a call with PRITYAA379\.$/, '');
      if (cleanText && voices.length > 0) {
          const utterance = new SpeechSynthesisUtterance(cleanText);
          const enVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Female'));
          utterance.voice = enVoice || voices.find(v => v.lang.startsWith('en')) || voices[0];
          
          const cleanupSpeech = () => {
              if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
              autoStopTimerRef.current = null;
              setIsBotSpeaking(false);
              onEndCallback?.();
          };

          utterance.onstart = () => {
              setIsBotSpeaking(true);
              if (autoStopDuration > 0) {
                  autoStopTimerRef.current = window.setTimeout(() => {
                      window.speechSynthesis.cancel();
                  }, autoStopDuration * 1000);
              }
          };
          
          utterance.onend = cleanupSpeech;
          utterance.onerror = cleanupSpeech;
          
          window.speechSynthesis.speak(utterance);
      } else {
          onEndCallback?.();
      }
  };
  
  const getHelpContent = () => `Of course! I'm Jura, an AI assistant. Here's a quick guide to my features:

**Core Features:**
- **Interactive Chat:** Just type a message to talk to me. I can help with ideas for digital products, social media content, and more.
- **Image Studio:** Access it from the navigation menu (swipe up from the bottom). You can generate images from text descriptions.
- **Article Writer:** Also in the nav menu, this tool helps you write complete articles on any topic.
- **To-Do List:** Manage your tasks by telling me to "add a task", "show my to-do list", etc. Also available in the nav menu.
- **Learning Zone:** Scroll down to find curated resources for digital creators.

**Voice & Conversation:**
- **Voice Input:** Click the microphone icon in the input bar to talk instead of type.
- **Non-Stop Mode:** For hands-free conversation, enable "Non-stop" in the nav menu.
- **Wake Word:** In Non-Stop mode, just say my name, **"${wakeWord}"**, to get my attention. You can change this in the nav menu.
- **Voice Commands:** You can change settings with your voice, like *"Jura, change wake word to Assistant"*.

**Advanced Analysis (Group Chat):**
- **Switch Modes:** Use the "Group Chat" toggle in the nav menu.
- **Analyze Text:** Paste a conversation, and I'll summarize it.
- **Analyze Audio/Video:** In Group Chat mode, use the new icons to upload an audio or video file for me to transcribe and analyze.

**My 3D Model:**
- You can click on the glowing hotspots on my 3D model to the right to learn about my different components.`;

  const submitMessage = async (messageText: string, options?: { isNtspStart?: boolean }) => {
    clearInactivityTimer();
    const currentInput = messageText.trim();
    if ((!currentInput && !uploadedImage && !uploadedAudio) || isLoading) return;
    
    // Handle special commands first
    if (currentInput.toLowerCase() === 'help') {
        setIsHelpModalOpen(true);
        return;
    }
    
    // Handle name input on first message
    if (!userName && !isConversationMode) {
        setUserName(currentInput);
        sessionStorage.setItem('userName', currentInput);
        if (isExploring) setIsExploring(false);
        setInputValue('');

        const userMessage: Message = { role: 'user', content: currentInput, timestamp: Date.now() };
        const modelWelcomeMessage: Message = {
            role: 'model',
            content: `Nice to meet you, ${currentInput}! How can I help you today?`,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMessage, modelWelcomeMessage]);
        setBlackboardData({ text: modelWelcomeMessage.content, image: '' });
        speakText(modelWelcomeMessage.content);

        if (ai) {
             const systemInstruction = getSystemInstruction(currentInput, isConversationMode);
             setChat(ai.chats.create({
                 ...chatModelConfig,
                 config: { ...chatModelConfig.config, systemInstruction }
             }));
        }
        return;
    }

    setInputValue(''); // Clear draft on submit
    setBlackboardData({ text: `User: "${currentInput}"`, image: '' });
    
    if (isExploring) setIsExploring(false);

    const processCommand = (regex: RegExp, action: (match: RegExpMatchArray) => { modelMessage: Message, sideEffect?: () => void }) => {
        const match = currentInput.match(regex);
        if (match) {
            const { modelMessage, sideEffect } = action(match);
            const userMessage: Message = { role: 'user', content: currentInput, timestamp: Date.now() };
            setMessages(prev => [...prev, userMessage, modelMessage]);
            setBlackboardData({ text: modelMessage.content, image: '' });
            speakText(modelMessage.content);
            sideEffect?.();
            return true;
        }
        return false;
    };

    if (processCommand(/^(?:add to my to-do list|add task|add todo):?\s*(.+)/i, match => ({ modelMessage: { role: 'model', content: `✅ Okay, I've added "${match[1]}" to your to-do list.`, timestamp: Date.now() }, sideEffect: () => handleAddTodo(match[1]) }))) return;
    if (processCommand(/^(?:show|view|open)\s*(?:my)?\s*to-do\s*list$/i, () => ({ modelMessage: { role: 'model', content: todos.length > 0 ? "Of course, here is your to-do list." : "Sure, opening your to-do list. It's currently empty!", timestamp: Date.now() }, sideEffect: () => setIsTodoModalOpen(true) }))) return;
    if (processCommand(/^(?:complete|finish|done|check off|mark as complete):?\s*(.+)/i, match => {
        const taskText = match[1].toLowerCase().trim();
        const task = todos.find(t => t.text.toLowerCase() === taskText && !t.completed);
        if (task) {
            handleToggleTodo(task.id);
            return { modelMessage: { role: 'model', content: `Great job! I've marked "${task.text}" as complete.`, timestamp: Date.now() } };
        }
        return { modelMessage: { role: 'model', content: `I couldn't find an incomplete task called "${match[1]}".`, timestamp: Date.now() } };
    })) return;
    if (processCommand(/^(?:remove|delete|remove from my to-do list):?\s*(.+)/i, match => {
        const taskText = match[1].toLowerCase().trim();
        const task = todos.find(t => t.text.toLowerCase() === taskText);
        if (task) {
            handleDeleteTodo(task.id);
            return { modelMessage: { role: 'model', content: `Okay, I've removed "${task.text}" from your list.`, timestamp: Date.now() } };
        }
        return { modelMessage: { role: 'model', content: `I couldn't find a task called "${match[1]}" on your list.`, timestamp: Date.now() } };
    })) return;

    if (!ai) return;

    const userMessage: Message = { role: 'user', content: currentInput, timestamp: Date.now(), imagePreview: uploadedImage?.preview, audioPreview: uploadedAudio ? { name: uploadedAudio.name } : undefined };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setIsLoading(true);
    setBlackboardData({ text: 'Thinking...', image: '' });
    const currentImage = uploadedImage;
    const currentAudio = uploadedAudio;
    setUploadedImage(null);
    setUploadedAudio(null);

    try {
      let responseText = '';
      let sources: { uri: string; title: string }[] | undefined = undefined;

      const file = currentImage || currentAudio;

      if (file) {
        const filePart = { inlineData: { mimeType: file.mimeType, data: file.b64 } };
        const textPart = { text: currentInput };
        const model = isConversationMode ? 'gemini-2.5-flash' : 'gemini-2.5-flash';
        const response = await ai.models.generateContent({ model, contents: { parts: [filePart, textPart] } });
        responseText = response.text;
      } else {
        if (!chat) throw new Error("Chat not initialized");
        const response = await chat.sendMessage({ message: currentInput });
        responseText = response.text;
        const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
        sources = groundingMetadata?.groundingChunks?.map((c: any) => c.web).filter((w: any) => w?.uri && w?.title).filter((v: any, i: number, s: any[]) => i === s.findIndex((t) => t.uri === v.uri));
      }
        
      const htmlRegex = /```html\n([\s\S]*?)\n```/;
      const htmlMatch = responseText.match(htmlRegex);
      setHtmlPreviewContent(htmlMatch ? htmlMatch[1] : null);

      const modelMessage: Message = { role: 'model', content: responseText, timestamp: Date.now(), sources };
      setMessages((prevMessages) => [...prevMessages, modelMessage]);
      setBlackboardData({ text: responseText, image: '' });
      speakText(responseText, () => {
          if (options?.isNtspStart) {
              continueMonologue();
          } else if (isNonStopModeRef.current) {
              userStoppedRef.current = false;
              recognitionRef.current?.start();
          }
      });
    } catch (error) {
      const errorMessageContent = getFriendlyErrorMessage(error);
      const errorMessage: Message = { role: 'error', content: errorMessageContent, timestamp: Date.now() };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
      setBlackboardData({ text: errorMessageContent, image: '' });
      setIsLoading(false);
    } finally {
      if (!isBotSpeaking) { // If speakText was not called or finished immediately
          setIsLoading(false);
      }
    }
  };
  
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitMessage(inputValue);
  };
  
  const toggleNonStopMode = () => {
    if (isNtspMode) toggleNtspMode();
    setSpeechError(null);
    setIsNavOpen(false);
    const newMode = !isNonStopMode;
    setIsAwaitingCommand(false);

    if (newMode) {
      if (isImageStudioOpen) setIsImageStudioOpen(false);
      if (isArticleWriterOpen) setIsArticleWriterOpen(false);
      setIsNonStopMode(true);
      userStoppedRef.current = false;
      recognitionRef.current?.start();
    } else {
      clearInactivityTimer();
      setIsNonStopMode(false);
      userStoppedRef.current = true;
      recognitionRef.current?.stop();
      window.speechSynthesis.cancel();
      setIsBotSpeaking(false);
    }
  };

  const toggleConversationMode = () => {
      if (isNtspMode) toggleNtspMode();
      if (!ai) return;
      const newMode = !isConversationMode;
      const newHistory = newMode ? groupChatHistory : mainChatHistory;
      
      setIsImageStudioOpen(false);
      setIsArticleWriterOpen(false);
      if (isNonStopMode) setIsNonStopMode(false);
      setIsAwaitingCommand(false);
      setIsConversationMode(newMode);
      setMessages(newHistory);
      setIsExploring(newHistory.length === 0);
      setBlackboardData({ text: 'Group Chat mode enabled. Upload audio or paste a conversation.', image: '' });
  
      if (ai) {
          const systemInstruction = getSystemInstruction(userName, newMode);
          setChat(ai.chats.create({
              ...chatModelConfig,
              config: { ...chatModelConfig.config, systemInstruction }
          }));
      }
      setIsNavOpen(false);
  };

  const handleOpenImageStudio = () => {
    if (isNtspMode) toggleNtspMode();
    if (isNonStopMode) setIsNonStopMode(false);
    setIsAwaitingCommand(false);
    setIsImageStudioOpen(true);
    setIsArticleWriterOpen(false);
    setIsExploring(false);
    setIsConversationMode(false);
    setMessages([]);
    setHtmlPreviewContent(null);
    setIsNavOpen(false);
    setGeneratedImageUrls([]);
    setImageGenError(null);
    setBlackboardData({ text: "Welcome to the Image Studio!", image: '' });
  };
  
  const handleOpenArticleWriter = () => {
    if (isNtspMode) toggleNtspMode();
    if (isNonStopMode) setIsNonStopMode(false);
    setIsAwaitingCommand(false);
    setIsArticleWriterOpen(true);
    setIsImageStudioOpen(false);
    setIsExploring(false);
    setIsConversationMode(false);
    setMessages([]);
    setHtmlPreviewContent(null);
    setIsNavOpen(false);
    setGeneratedArticle('');
    setArticleGenError(null);
    setBlackboardData({ text: "Welcome to the Article Writer!", image: '' });
  };

  const handleEnhancePrompt = async () => {
    if (!imageGenPrompt.trim() || !ai) return;
    setIsEnhancingPrompt(true);
    const originalPrompt = imageGenPrompt;
    setBlackboardData({ text: `Enhancing: "${originalPrompt}"`, image: '' });
    try {
        const systemInstruction = "You are an expert prompt engineer for an AI image generator. Enhance the following user prompt to be more vivid, detailed, and descriptive. Return only the enhanced prompt, nothing else.";
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `User prompt: "${imageGenPrompt}"`,
            config: { systemInstruction },
        });
        const enhancedText = response.text.trim();
        setImageGenPrompt(enhancedText);
        setBlackboardData({ text: enhancedText, image: '' });
    } catch (error) {
        const errorMsg = getFriendlyErrorMessage(error);
        setImageGenError(`Prompt enhancement failed: ${errorMsg}`);
        setBlackboardData({ text: `Prompt enhancement failed: ${errorMsg}`, image: '' });
    } finally {
        setIsEnhancingPrompt(false);
    }
  };
  
  const handleGenerateArticle = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!articleTopic.trim() || !ai) return;
      setIsGeneratingArticle(true);
      setGeneratedArticle('');
      setArticleGenError(null);
      setBlackboardData({ text: 'Writing your article...', image: '' });

      try {
          const systemInstruction = `You are an expert article writer specializing in creating engaging, well-structured, and SEO-friendly content. Your goal is to generate a comprehensive article based on the user's request. The article should have a clear introduction, body, and conclusion. Use headings and subheadings (using markdown for formatting, e.g., ## Heading) to structure the content logically. Ensure the tone and language are appropriate for the specified target audience. Do not include the mandatory closing statement "Book a call with PRITYAA379." in this article.`;
          
          const prompt = `
              Topic/Headline: "${articleTopic}"
              Keywords to include: "${articleKeywords}"
              Tone of voice: "${articleTone}"
              Target Audience: "${articleAudience}"

              Please write the article now.
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
              config: { systemInstruction },
          });
          
          const articleText = response.text;
          setGeneratedArticle(articleText);
          setBlackboardData({ text: `Article generated for: "${articleTopic}"`, image: '' });

      } catch (error) {
          const errorMsg = getFriendlyErrorMessage(error);
          setArticleGenError(errorMsg);
          setBlackboardData({ text: errorMsg, image: '' });
      } finally {
          setIsGeneratingArticle(false);
      }
  };

  const handleGenerateImage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!imageGenPrompt.trim() || !ai) return;
      setIsGeneratingImage(true);
      setGeneratedImageUrls([]);
      setImageGenError(null);
      setBlackboardData({ text: 'Generating your masterpiece...', image: '' });
      try {
          let finalPrompt = imageGenPrompt;
          if (imageGenText.trim()) {
              finalPrompt += `. The image must include the text: "${imageGenText.trim()}".`;
          }
          if (imageGenStyle !== 'none') {
              finalPrompt += `. Style: ${imageGenStyle}.`;
          }
          
          const params: any = {
              model: 'imagen-4.0-generate-001',
              prompt: finalPrompt,
              config: {
                  numberOfImages: 4,
                  outputMimeType: 'image/png',
                  aspectRatio: imageGenAspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
              },
          };
          
          if (imageGenNegativePrompt.trim()) {
              params.config.negativePrompt = imageGenNegativePrompt.trim();
          }
          if (imageGenSeed.trim()) {
              params.config.seed = parseInt(imageGenSeed, 10);
          }
          if (referenceImage) {
              params.image = {
                  imageBytes: referenceImage.b64,
                  mimeType: referenceImage.mimeType,
              };
          }

          const response = await ai.models.generateImages(params);
          if (response.generatedImages && response.generatedImages.length > 0) {
              const base64ImageUrls = response.generatedImages.map(img => `data:image/png;base64,${img.image.imageBytes}`);
              setGeneratedImageUrls(base64ImageUrls);
              setBlackboardData({ text: '', image: base64ImageUrls[0] });
          } else {
              const errorMsg = "The model did not return any images. Please try a different prompt.";
              setImageGenError(errorMsg);
              setBlackboardData({ text: errorMsg, image: '' });
          }
      } catch (error) {
          const errorMsg = getFriendlyErrorMessage(error);
          setImageGenError(errorMsg);
          setBlackboardData({ text: errorMsg, image: '' });
      } finally {
          setIsGeneratingImage(false);
      }
  };
  
    const handleRandomizeSeed = () => {
        setImageGenSeed(String(Math.floor(Math.random() * 1000000000)));
    };
    
    const handleReferenceImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64String = (e.target?.result as string);
            setReferenceImage({ b64: base64String.split(',')[1], mimeType: file.type, preview: base64String });
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

  const translateContent = async (text: string, lang: string) => {
      if (!ai || lang === 'en-US') { setTranslatedContent(text); return; }
      setIsTranslating(true);
      try {
          const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Translate to ${lang}. Keep markdown: \n\n${text}` });
          setTranslatedContent(response.text);
      } catch (error) {
          const errorMsg = getFriendlyErrorMessage(error);
          setTranslatedContent(`Sorry, translation failed. Reason: ${errorMsg}`);
      } finally {
          setIsTranslating(false);
      }
  };

  const handleCardClick = (card: CardData) => {
    setSelectedCard(card);
    setTranslatedContent(card.description);
    if(currentLanguage !== 'en-US') translateContent(card.description, currentLanguage);
  };

  const handleCloseModal = () => {
    window.speechSynthesis.cancel();
    setIsModalSpeaking(false);
    setSelectedCard(null);
    setTranslatedContent('');
    setCurrentLanguage('en-US');
  };
  
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newLang = e.target.value;
      setCurrentLanguage(newLang);
      if (selectedCard) translateContent(selectedCard.description, newLang);
  };
  
  const handleListen = () => {
      if (isModalSpeaking) {
          window.speechSynthesis.cancel();
          setIsModalSpeaking(false);
          return;
      }
      if (translatedContent && voices.length > 0) {
          const utterance = new SpeechSynthesisUtterance(translatedContent.replace(/\*\*/g, ''));
          utterance.lang = currentLanguage;
          let selectedVoice = voices.find(v => v.lang === currentLanguage && v.name.includes('Female')) || voices.find(v => v.lang === currentLanguage);
          if (!selectedVoice) selectedVoice = voices.find(v => v.lang.startsWith(currentLanguage.split('-')[0]) && v.name.includes('Female')) || voices.find(v => v.lang.startsWith(currentLanguage.split('-')[0]));
          if (selectedVoice) utterance.voice = selectedVoice;
          utterance.onend = () => setIsModalSpeaking(false);
          window.speechSynthesis.speak(utterance);
          setIsModalSpeaking(true);
      }
  };
  
  const handleStartLearningClick = () => { setVibrate(true); setTimeout(() => setVibrate(false), 500); };
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, fileType: 'audio' | 'image' | 'video') => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
          const base64String = (e.target?.result as string);
          const fileData = { b64: base64String.split(',')[1], mimeType: file.type, name: file.name };
          if (fileType === 'audio') setUploadedAudio(fileData);
          if (fileType === 'image') setUploadedImage({ ...fileData, preview: base64String });
      };
      reader.readAsDataURL(file);
      event.target.value = '';
  };
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (selectedCard) handleCloseModal();
        if (isTodoModalOpen) setIsTodoModalOpen(false);
        if (isHelpModalOpen) setIsHelpModalOpen(false);
        if (selectedImageForModal) setSelectedImageForModal(null);
      }
    };
    if (selectedCard || isTodoModalOpen || selectedImageForModal || isHelpModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
      modalRef.current?.focus();
    }
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, [selectedCard, isTodoModalOpen, selectedImageForModal, isHelpModalOpen]);

  const inspireMe = () => {
    const randomPrompt = suggestionPrompts[Math.floor(Math.random() * suggestionPrompts.length)];
    submitMessage(randomPrompt);
  };
  
  const inspireMeImage = () => {
    const imagePrompts = [
      "A photorealistic image of a cat wearing a tiny wizard hat, studying a glowing book of spells in a cozy library.",
      "A vibrant digital painting of a futuristic city with flying vehicles and holographic advertisements, at sunset.",
      "An astronaut planting a flag on Mars, with Earth visible in the distant sky. Cinematic, realistic style.",
      "A logo for a coffee shop called 'The Daily Grind', minimalist design with a coffee bean and a sunrise.",
      "A whimsical illustration of a treehouse village built on giant, glowing mushrooms in an enchanted forest."
    ];
    setImageGenPrompt(imagePrompts[Math.floor(Math.random() * imagePrompts.length)]);
  };

  const replaySpeech = (text: string) => {
    if (isBotSpeaking) window.speechSynthesis.cancel();
    speakText(text);
  };
  
  const renderMessageContent = (msg: Message) => (
    <>
        {msg.imagePreview && <img src={msg.imagePreview} alt="User upload preview" className="message-image-preview" />}
        {msg.audioPreview && <div className="message-file-preview"><i className='bx bxs-music'></i><span>{msg.audioPreview.name}</span></div>}
        <div dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) as string }} />
        {msg.role === 'model' && (
            <div className="message-footer">
                {msg.sources && msg.sources.length > 0 && (
                    <div className="sources-container">
                        <h4>Sources</h4>
                        <ul>{msg.sources.map((source, i) => <li key={i}><a href={source.uri} target="_blank" rel="noopener noreferrer">{source.title || source.uri}</a></li>)}</ul>
                    </div>
                )}
                <button className="replay-speech-btn" onClick={() => replaySpeech(msg.content)} aria-label="Replay audio for this message">
                    <i className='bx bx-volume-full'></i>
                </button>
            </div>
        )}
    </>
  );

  const handleExportChat = () => {
    const formattedChat = messages.map(msg => {
        const prefix = `**${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}:**`;
        return `${prefix}\n\n${msg.content}`;
    }).join('\n\n---\n\n');

    const blob = new Blob([formattedChat], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jura-chat-history-${new Date().toISOString()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsNavOpen(false);
  };

  const handleAnalyzeConversationClick = () => {
    if (!isConversationMode) {
      toggleConversationMode();
    }
    audioFileInputRef.current?.click();
  };

  return (
    <div className="app-container">
      <header>
        <div className="header-left">
          <svg className="logo-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 20 H80 V80 H20 Z" stroke="#80cbc4" strokeWidth="8" />
            <path d="M35 35 H65 V65 H35 Z" stroke="#80cbc4" strokeWidth="6" opacity="0.7" />
          </svg>
          <h1>DIGITALCONFVISIONS</h1>
        </div>
         <div className="header-right">
            <button
              className="icon-btn theme-toggle-btn"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <i className={`bx ${theme === 'dark' ? 'bxs-sun' : 'bxs-moon'}`}></i>
            </button>
            <select className="language-selector" value={currentLanguage} onChange={handleLanguageChange} aria-label="Select language">
                <option value="en-US">English</option>
                <option value="es-ES">Español</option>
                <option value="fr-FR">Français</option>
                <option value="de-DE">Deutsch</option>
                <option value="hi-IN">हिन्दी</option>
            </select>
        </div>
      </header>
      <main>
        <div className="primary-view">
            <section className="chat-container">
            {isImageStudioOpen ? (
                <div className="image-studio-container">
                    <div className="image-studio-header">
                        <h3><i className='bx bx-paint'></i> Image Studio</h3>
                        <p>Generate unique, high-quality images with advanced controls.</p>
                    </div>
                    <div className="image-display-area">
                        {isGeneratingImage ? (
                            <div className="image-grid">
                                {Array(4).fill(0).map((_, i) => <div key={i} className="image-grid-item placeholder"><div className="typing-indicator"><span></span><span></span><span></span></div></div>)}
                            </div>
                        ) : generatedImageUrls.length > 0 ? (
                            <div className="image-grid">
                                {generatedImageUrls.map((url, i) => <div key={i} className="image-grid-item" onClick={() => setSelectedImageForModal(url)}><img src={url} alt={`Generated by AI ${i + 1}`} /></div>)}
                            </div>
                        ) : (
                            <div className="image-grid-placeholder">
                                <i className='bx bx-image-add'></i>
                                <p>{imageGenError || "Your generated images will appear here"}</p>
                            </div>
                        )}
                    </div>
                    <form className="image-gen-form" onSubmit={handleGenerateImage}>
                        <div className="prompt-input-wrapper">
                            <textarea value={imageGenPrompt} onChange={(e) => setImageGenPrompt(e.target.value)} placeholder="e.g., A robot holding a red skateboard..." rows={2} disabled={isGeneratingImage || isEnhancingPrompt} aria-label="Image generation prompt" />
                            <button type="button" className="juras-vision-btn" onClick={handleEnhancePrompt} disabled={isGeneratingImage || isEnhancingPrompt || !imageGenPrompt.trim()} title="Enhance prompt with AI">
                                <i className={`bx ${isEnhancingPrompt ? 'bx-loader-alt bx-spin' : 'bxs-magic-wand'}`}></i>
                                <span>Jura's Vision</span>
                            </button>
                        </div>
                        <div className="image-gen-field">
                            <label htmlFor="image-negative-prompt">Negative Prompt (what to avoid)</label>
                            <textarea id="image-negative-prompt" value={imageGenNegativePrompt} onChange={e => setImageGenNegativePrompt(e.target.value)} placeholder="e.g., text, blurry, watermark..." rows={1} disabled={isGeneratingImage} />
                        </div>

                        <div className="image-gen-field">
                            <label htmlFor="image-text">Text to Include</label>
                            <input type="text" id="image-text" value={imageGenText} onChange={e => setImageGenText(e.target.value)} placeholder="Optional: text to appear in the image" disabled={isGeneratingImage} />
                        </div>
                        <input type="file" ref={referenceImageInputRef} onChange={handleReferenceImageUpload} accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} />
                        <div className="image-gen-controls">
                            <div className="image-gen-field">
                                <label htmlFor="aspect-ratio">Aspect Ratio</label>
                                <select id="aspect-ratio" value={imageGenAspectRatio} onChange={(e) => setImageGenAspectRatio(e.target.value)} disabled={isGeneratingImage}>
                                    <option value="1:1">Square</option><option value="16:9">Landscape</option><option value="9:16">Portrait</option><option value="4:3">Photo</option><option value="3:4">Photo</option>
                                </select>
                            </div>
                             <div className="image-gen-field">
                                <label htmlFor="image-style">Style</label>
                                <select id="image-style" value={imageGenStyle} onChange={(e) => setImageGenStyle(e.target.value)} disabled={isGeneratingImage}>
                                    <option value="none">None</option><option value="photorealistic">Photorealistic</option><option value="cinematic">Cinematic</option><option value="anime">Anime</option><option value="digital-art">Digital Art</option><option value="3d-render">3D Render</option><option value="illustration">Illustration</option><option value="retro">Retro</option>
                                </select>
                            </div>
                            <div className="image-gen-field seed-field">
                                <label htmlFor="image-seed">Seed</label>
                                <div className="seed-input-wrapper">
                                    <input type="text" id="image-seed" value={imageGenSeed} onChange={e => setImageGenSeed(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Random" disabled={isGeneratingImage} />
                                    <button type="button" className="randomize-seed-btn" onClick={handleRandomizeSeed} disabled={isGeneratingImage} title="Randomize Seed"><i className='bx bx-dice-5'></i></button>
                                </div>
                            </div>
                            <div className="image-gen-field">
                                <label>Reference</label>
                                {referenceImage ? (
                                    <div className="reference-image-preview">
                                        <img src={referenceImage.preview} alt="Reference" />
                                        <button type="button" onClick={() => setReferenceImage(null)}>&times;</button>
                                    </div>
                                ) : (
                                    <button type="button" className="upload-reference-btn" onClick={() => referenceImageInputRef.current?.click()} disabled={isGeneratingImage}>
                                        <i className='bx bx-image-add'></i> Upload
                                    </button>
                                )}
                            </div>
                            <button type="button" className="inspire-me-btn" onClick={inspireMeImage} disabled={isGeneratingImage}>Inspire Me</button>
                            <button type="submit" className="generate-btn" disabled={isGeneratingImage || isEnhancingPrompt || !imageGenPrompt.trim()}>
                                <i className='bx bx-rocket'></i> Generate
                            </button>
                        </div>
                    </form>
                </div>
              ) : isArticleWriterOpen ? (
                <div className="article-writer-container">
                  <div className="article-writer-header">
                      <h3><i className='bx bxs-file-doc'></i> Article Writer</h3>
                      <p>Craft a complete article based on your topic and keywords.</p>
                  </div>
                  <div className="article-display-area">
                    {isGeneratingArticle ? (
                        <div className="typing-indicator-wrapper">
                          <div className="typing-indicator"><span></span><span></span><span></span></div>
                          <span>Jura is writing...</span>
                        </div>
                      ) : articleGenError ? (
                        <div className="placeholder-text error-text">{articleGenError}</div>
                      ) : generatedArticle ? (
                        <div className="rendered-article" dangerouslySetInnerHTML={{ __html: marked.parse(generatedArticle) as string }} />
                      ) : (
                        <div className="placeholder-text">Your generated article will appear here.</div>
                      )}

                    {generatedArticle && !isGeneratingArticle && (
                      <button 
                        className="copy-article-btn"
                        onClick={() => navigator.clipboard.writeText(generatedArticle)}
                      >
                        <i className='bx bx-copy'></i> Copy Raw Markdown
                      </button>
                    )}
                  </div>
                  <form className="article-gen-form" onSubmit={handleGenerateArticle}>
                    <div className="article-gen-field">
                        <label htmlFor="article-topic">Topic / Headline</label>
                        <input type="text" id="article-topic" value={articleTopic} onChange={e => setArticleTopic(e.target.value)} placeholder="e.g., The Future of Renewable Energy" disabled={isGeneratingArticle} />
                    </div>
                    <div className="article-gen-field">
                        <label htmlFor="article-keywords">Keywords (comma-separated)</label>
                        <input type="text" id="article-keywords" value={articleKeywords} onChange={e => setArticleKeywords(e.target.value)} placeholder="e.g., solar, wind, sustainability" disabled={isGeneratingArticle} />
                    </div>
                    <div className="article-gen-controls">
                      <div className="article-gen-field">
                          <label htmlFor="article-tone">Tone of Voice</label>
                          <select id="article-tone" value={articleTone} onChange={(e) => setArticleTone(e.target.value)} disabled={isGeneratingArticle}>
                              <option value="Professional">Professional</option>
                              <option value="Casual">Casual</option>
                              <option value="Witty">Witty</option>
                              <option value="Enthusiastic">Enthusiastic</option>
                              <option value="Formal">Formal</option>
                          </select>
                      </div>
                      <div className="article-gen-field">
                          <label htmlFor="article-audience">Target Audience</label>
                          <select id="article-audience" value={articleAudience} onChange={(e) => setArticleAudience(e.target.value)} disabled={isGeneratingArticle}>
                              <option value="General">General</option>
                              <option value="Beginners">Beginners</option>
                              <option value="Experts">Experts</option>
                              <option value="Students">Students</option>
                              <option value="Professionals">Professionals</option>
                          </select>
                      </div>
                      <button type="submit" className="generate-btn" disabled={isGeneratingArticle || !articleTopic.trim()}>
                          {isGeneratingArticle ? <div className="typing-indicator" style={{padding:0}}><span></span><span></span><span></span></div> : <><i className='bx bx-pencil'></i> Generate</>}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <>
                  <div className="chat-area" ref={chatAreaRef}>
                    {isExploring && !userName ? (
                      <div className="energy-booster-view">
                          <div className="energy-booster-header">
                              <svg className="explore-logo" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M20 20 H80 V80 H20 Z" stroke="#80cbc4" strokeWidth="8" />
                                  <path d="M35 35 H65 V65 H35 Z" stroke="#80cbc4" strokeWidth="6" opacity="0.7" />
                              </svg>
                              <h2>Jura's Energy Booster</h2>
                              <p>Quick actions to jumpstart your creativity and analysis.</p>
                          </div>
                          <div className="energy-booster-grid">
                              <div className="energy-card" onClick={inspireMe}>
                                  <i className='bx bx-bulb'></i>
                                  <h4>Spark an Idea</h4>
                                  <p>Generate a unique digital product concept.</p>
                              </div>
                              <div className="energy-card" onClick={handleAnalyzeConversationClick}>
                                  <i className='bx bx-upload'></i>
                                  <h4>Analyze Conversation</h4>
                                  <p>Upload audio to transcribe and summarize.</p>
                              </div>
                              <div className="energy-card" onClick={() => submitMessage('Create a 14-second reel script about sustainable fashion')}>
                                  <i className='bx bx-camera-movie'></i>
                                  <h4>Create a Reel Script</h4>
                                  <p>Draft a short, engaging video script.</p>
                              </div>
                              <div className="energy-card" onClick={() => submitMessage('Give me a life solution for managing stress')}>
                                  <i className='bx bx-heart'></i>
                                  <h4>Find a Life Solution</h4>
                                  <p>Get practical advice for life's challenges.</p>
                              </div>
                          </div>
                      </div>
                    ) : (
                      <>
                        {(() => {
                          let lastDate: string | null = null;
                          return messages.map((msg, index) => {
                            let dateSeparator = null;
                            if (msg.timestamp) {
                              const currentDate = formatDateSeparator(msg.timestamp);
                              if (currentDate !== lastDate) {
                                dateSeparator = <div key={`date-${index}`} className="date-separator">{currentDate}</div>;
                                lastDate = currentDate;
                              }
                            }

                            return (
                              <React.Fragment key={index}>
                                {dateSeparator}
                                <div className={`message-wrapper ${msg.role}-wrapper`}>
                                  <div className={`message-bubble ${msg.role}-bubble`}>
                                    {renderMessageContent(msg)}
                                    {msg.timestamp && <span className="message-timestamp">{formatMessageTime(msg.timestamp)}</span>}
                                  </div>
                                </div>
                              </React.Fragment>
                            );
                          });
                        })()}
                        {isLoading && (
                          <div className="message-wrapper model-wrapper">
                            <div className="message-bubble model-bubble"><div className="typing-indicator"><span></span><span></span><span></span></div></div>
                          </div>
                        )}
                        {voiceCommandFeedback && <div className="voice-command-feedback">{voiceCommandFeedback}</div>}
                      </>
                    )}
                  </div>
                  <div className="chat-input-area">
                    {speechError && <div className="speech-error-banner">{speechError}</div>}
                    {uploadedImage && (
                        <div className="file-preview-container">
                            <img src={uploadedImage.preview} alt="Image preview" />
                            <button onClick={() => setUploadedImage(null)}>&times;</button>
                        </div>
                    )}
                    {uploadedAudio && (
                        <div className="file-preview-container audio-preview">
                            <i className='bx bxs-music'></i>
                            <span>{uploadedAudio.name}</span>
                            <button onClick={() => setUploadedAudio(null)}>&times;</button>
                        </div>
                    )}
                    <div className="swipe-up-container">
                        <button className="swipe-up-handle" onClick={() => setIsNavOpen(!isNavOpen)} aria-label="Toggle navigation" aria-expanded={isNavOpen}>
                            <i className={`bx ${isNavOpen ? 'bx-chevron-down' : 'bx-chevron-up'}`}></i>
                        </button>
                        <nav className={`swipe-up-nav ${isNavOpen ? 'open' : ''}`}>
                            <a href="#" className="nav-item" onClick={(e) => {e.preventDefault(); handleNewChat();}}><i className='bx bx-plus-circle'></i><span>New Chat</span></a>
                            <a href="#" className="nav-item" onClick={(e) => {e.preventDefault(); setIsTodoModalOpen(true); setIsNavOpen(false);}}><i className='bx bx-list-check'></i><span>To-Do List</span></a>
                            <a href="#" className={`nav-item ${isImageStudioOpen ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleOpenImageStudio(); }}><i className='bx bx-paint'></i><span>Image Studio</span></a>
                            <a href="#" className={`nav-item ${isArticleWriterOpen ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleOpenArticleWriter(); }}><i className='bx bxs-file-doc'></i><span>Article Writer</span></a>
                            <a href="#" className="nav-item" onClick={(e) => { e.preventDefault(); setIsHelpModalOpen(true); setIsNavOpen(false); }}><i className='bx bx-help-circle'></i><span>Help</span></a>
                            <a href="#" className={`nav-item ${isNonStopMode ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); toggleNonStopMode(); }}><i className='bx bx-infinite'></i><span>Non-stop</span></a>
                            <a href="#" className={`nav-item ${isNtspMode ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); toggleNtspMode(); }}><i className='bx bx-broadcast'></i><span>NTSP</span></a>
                            <a href="#" className={`nav-item ${isConversationMode ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); toggleConversationMode(); }}><i className='bx bx-group'></i><span>Group Chat</span></a>
                            <a href="#" className="nav-item" onClick={(e) => { e.preventDefault(); handleExportChat(); }}><i className='bx bx-export'></i><span>Export Chat</span></a>
                            <a href="#" className="nav-item" onClick={(e) => { e.preventDefault(); handleClearHistory(); }}><i className='bx bx-trash'></i><span>Clear History</span></a>
                             <div className="nav-item-select">
                                <label htmlFor="auto-stop-select"><i className='bx bx-time-five'></i> Auto-Stop</label>
                                <select id="auto-stop-select" value={autoStopDuration} onChange={(e) => setAutoStopDuration(parseInt(e.target.value, 10))}>
                                    <option value="0">Off</option><option value="15">15s</option><option value="30">30s</option>
                                </select>
                            </div>
                            <div className="nav-item-input">
                               <label htmlFor="wake-word-input"><i className='bx bxs-magic-wand'></i> Wake Word</label>
                               <input type="text" id="wake-word-input" value={wakeWord} onChange={(e) => setWakeWord(e.target.value)} />
                            </div>
                        </nav>
                    </div>
                    <form className={`message-input-form ${isNonStopMode ? 'non-stop-active' : ''} ${isNtspMode ? 'ntsp-active' : ''}`} onSubmit={handleFormSubmit}>
                      <input type="file" ref={imageFileInputRef} onChange={(e) => handleFileUpload(e, 'image')} accept="image/png,image/jpeg,image/webp,image/heic,image/heif" style={{ display: 'none' }} />
                      <input type="file" ref={audioFileInputRef} onChange={(e) => handleFileUpload(e, 'audio')} accept="audio/*" style={{ display: 'none' }} />
                      
                      {isConversationMode ? (
                          <button type="button" className="icon-btn" onClick={() => audioFileInputRef.current?.click()} aria-label="Upload audio file"><i className='bx bxs-music'></i></button>
                      ) : (
                          <button type="button" className="icon-btn" onClick={() => imageFileInputRef.current?.click()} aria-label="Upload image"><i className='bx bx-paperclip'></i></button>
                      )}
                      
                      <button type="button" className={`icon-btn mic-mute-btn ${isMicMuted ? 'muted' : ''}`} onClick={() => setIsMicMuted(!isMicMuted)} aria-label="Mute microphone"><i className={`bx ${isMicMuted ? 'bxs-microphone-off' : 'bxs-microphone'}`}></i></button>
                      <button type="button" className={`icon-btn speaker-mute-btn ${isMuted ? 'muted' : ''}`} onClick={() => setIsMuted(!isMuted)} aria-label="Mute Jura's voice"><i className={`bx ${isMuted ? 'bx-volume-mute' : 'bx-volume-full'}`}></i></button>
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => {
                            setInputValue(e.target.value);
                            setSpeechError(null);
                            if (isNtspMode) toggleNtspMode();
                            if (isNonStopMode) {
                                setIsNonStopMode(false);
                                setIsAwaitingCommand(false);
                                userStoppedRef.current = true;
                                recognitionRef.current?.stop();
                            }
                        }}
                        placeholder={
                            !userName ? "What's your name?" :
                            isNtspMode ? "Jura is in monologue mode. Press mic to stop." :
                            isNonStopMode ? isBotSpeaking ? "Jura is speaking..." 
                            : isAwaitingCommand ? "Listening for command..." 
                            : `Say "${wakeWord}"...`
                            : isListening ? "Listening..."
                            : isConversationMode ? "Upload audio or describe the discussion..."
                            : "Input concepts, upload image, or use voice..."
                        }
                        disabled={isLoading || isNtspMode}
                        aria-label="Chat input"
                      />
                      <button type="button" className={`icon-btn voice-activation-btn ${micVibrate ? 'vibrate' : ''}`} onClick={handleVoiceButtonClick} aria-label="Activate voice input">
                         <i className={`bx ${
                            isNtspMode ? 'bx-stop-circle' :
                            isBotSpeaking ? `bx-volume-full ${isNonStopMode ? 'interruptible' : ''}` :
                            isListening ? `bxs-microphone-off pulsating ${isAwaitingCommand ? 'awaiting-command' : ''}` :
                            'bxs-microphone'
                         }`}></i>
                      </button>
                      <button type="submit" className="icon-btn" disabled={isLoading || isNtspMode || (!inputValue.trim() && !uploadedImage && !uploadedAudio)} aria-label="Send message"><i className='bx bxs-send'></i></button>
                    </form>
                  </div>
                </>
              )}
            </section>
            {htmlPreviewContent ? (
                <section className="preview-section">
                    <div className="phone-preview">
                        <div className="phone-notch"></div>
                        <iframe className="preview-iframe" srcDoc={htmlPreviewContent} title="Live HTML Preview" sandbox="allow-scripts"></iframe>
                    </div>
                </section>
            ) : (
                <section className="machine-section">
                    <div className="blackboard-container">
                        <div className="blackboard-content">
                            {blackboardData.image ? (
                                <img src={blackboardData.image} alt="Generated content on blackboard" />
                            ) : (
                                <p ref={blackboardTextRef}>{blackboardData.text}</p>
                            )}
                        </div>
                    </div>
                    <div className="robo-girl-container">
                        <svg className="robo-girl-svg" viewBox="0 0 300 350" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <linearGradient id="pluto-main-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#1a237e" />
                                    <stop offset="100%" stopColor="#4a148c" />
                                </linearGradient>
                                <linearGradient id="pluto-accent-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#64ffda" />
                                    <stop offset="100%" stopColor="#ff4081" />
                                </linearGradient>
                                <radialGradient id="visor-glow-gradient">
                                    <stop offset="0%" stopColor="#64ffda" stopOpacity="0.8" />
                                    <stop offset="100%" stopColor="#64ffda" stopOpacity="0" />
                                </radialGradient>
                                <filter id="glitch-effect" x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur in="SourceGraphic" stdDeviation="1" />
                                </filter>
                                <filter id="hotspot-glow" x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                                    <feMerge>
                                        <feMergeNode in="blur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                            </defs>
                            
                            {/* 8D "Glitch" Effect Layers */}
                            <g opacity="0.4" style={{ animation: 'glitch-shift-1 8s infinite alternate' }}>
                                <path d="M120 180 C100 230, 100 280, 125 320" stroke="#ff4081" strokeWidth="1.5" fill="none" />
                                <path d="M180 180 C200 230, 200 280, 175 320" stroke="#ff4081" strokeWidth="1.5" fill="none" />
                            </g>
                            <g opacity="0.4" style={{ animation: 'glitch-shift-2 8s infinite alternate' }}>
                                <path d="M100 120 L80 150 L90 250" stroke="#64ffda" strokeWidth="1.5" fill="none" />
                                <path d="M200 120 L220 150 L210 250" stroke="#64ffda" strokeWidth="1.5" fill="none" />
                            </g>

                            <g className="robo-body">
                                {/* Base Shadow */}
                                <ellipse cx="150" cy="335" rx="70" ry="10" fill="url(#pluto-accent-gradient)" opacity="0.4" filter="url(#glitch-effect)" />

                                {/* Main Body */}
                                <path d="M150 340 L120 250 H180 L150 340 Z" fill="url(#pluto-main-gradient)" />
                                <path d="M110 255 C150 220, 190 220, 210 255 L210 280 Q150 320 90 280 L90 255" fill="url(#pluto-main-gradient)" stroke="#0c144e" strokeWidth="2" />
                                <path d="M150 215 C110 215, 90 180, 90 150 C90 100, 110 80, 150 80 C190 80, 210 100, 210 150 C210 180, 190 215, 150 215 Z" fill="#0c144e" />
                                
                                {/* Head and Visor */}
                                <path d="M150,225 C100,225 80,180 80,140 C80,80 110,40 150,40 C190,40 220,80 220,140 C220,180 200,225 150,225 Z" fill="url(#pluto-main-gradient)" />
                                <path d="M95 125 C110 110, 190 110, 205 125 L210 160 C190 175, 110 175, 90 160 L95 125 Z" fill="url(#visor-glow-gradient)" />
                                <path d="M95 125 C110 110, 190 110, 205 125 L210 160 C190 175, 110 175, 90 160 L95 125 Z" stroke="url(#pluto-accent-gradient)" strokeWidth="2" fill="none" />
                                <rect className="visor-scanline" x="90" y="115" width="120" height="3" fill="#ffffff" />

                                {/* Antennae */}
                                <path d="M100 45 L80 20" stroke="url(#pluto-accent-gradient)" strokeWidth="2" />
                                <circle cx="80" cy="20" r="4" fill="url(#pluto-accent-gradient)" className="glow" />
                                <path d="M200 45 L220 20" stroke="url(#pluto-accent-gradient)" strokeWidth="2" />
                                <circle cx="220" cy="20" r="4" fill="url(#pluto-accent-gradient)" className="glow" />

                                {/* Neck and Pauldrons */}
                                <path d="M135 220 C135 235, 165 235, 165 220" stroke="#0c144e" strokeWidth="4" fill="url(#pluto-main-gradient)" />
                                <path d="M90 255 C70 240, 70 220, 90 210" fill="url(#pluto-main-gradient)" />
                                <path d="M210 255 C230 240, 230 220, 210 210" fill="url(#pluto-main-gradient)" />
                            </g>

                            {/* Hotspots - Non-interactive visual elements */}
                            <g style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
                                <circle cx="150" cy="145" r="8" fill="url(#pluto-accent-gradient)" opacity="0.6" filter="url(#hotspot-glow)" className="hotspot" />
                                <circle cx="100" cy="270" r="8" fill="url(#pluto-accent-gradient)" opacity="0.6" filter="url(#hotspot-glow)" className="hotspot" />
                                <circle cx="200" cy="270" r="8" fill="url(#pluto-accent-gradient)" opacity="0.6" filter="url(#hotspot-glow)" className="hotspot" />
                            </g>
                        </svg>
                    </div>
                </section>
            )}
        </div>
        {!isImageStudioOpen && !isArticleWriterOpen && (
            <footer>
                <section className={`learning-zone-toggle ${isLearningZoneOpen ? 'open' : ''}`}>
                    <button className={vibrate ? 'vibrate' : ''} onMouseDown={handleStartLearningClick} onClick={() => setIsLearningZoneOpen(!isLearningZoneOpen)}>
                        {isLearningZoneOpen ? "Hide Learning Zone" : "Enter Learning Zone"}
                    </button>
                </section>
                <div className={`learning-zone-content ${isLearningZoneOpen ? 'open' : ''}`}>
                    <section className="content-section">
                        <h2>Curated Resources for Digital Creators</h2>
                    </section>
                    <section className="card-grid">
                        {cardData.map((card, index) => (
                            <div className="card" key={index} style={{ '--bg1': card.colors[0], '--bg2': card.colors[1], animationDelay: `${index * 0.1}s` } as React.CSSProperties} onClick={() => handleCardClick(card)}>
                                <h3>{card.name}</h3>
                            </div>
                        ))}
                    </section>
                </div>
            </footer>
        )}
      </main>
      
        {selectedCard && (
            <div className="modal-overlay" onClick={handleCloseModal}>
                <div className="modal-content" ref={modalRef} onClick={(e) => e.stopPropagation()} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="modal-title">
                    <button className="modal-close-btn" onClick={handleCloseModal} aria-label="Close modal">&times;</button>
                    <h2 id="modal-title">{selectedCard.name}</h2>
                    <div className="modal-body">
                        {isTranslating ? (
                            <div className="typing-indicator" style={{ justifyContent: 'center' }}><span></span><span></span><span></span></div>
                        ) : (
                            <div dangerouslySetInnerHTML={{ __html: marked.parse(translatedContent) as string }} />
                        )}
                    </div>
                    <div className="modal-footer">
                        <button className="modal-action-btn" onClick={handleListen}>
                           <i className={`bx ${isModalSpeaking ? 'bx-stop-circle' : 'bx-volume-full'}`}></i>{isModalSpeaking ? 'Stop' : 'Listen'}
                        </button>
                        <a href={selectedCard.link} target="_blank" rel="noopener noreferrer" className="modal-action-btn primary">
                            Visit Website <i className='bx bx-link-external'></i>
                        </a>
                    </div>
                </div>
            </div>
        )}
        
        {isHelpModalOpen && (
            <div className="modal-overlay" onClick={() => setIsHelpModalOpen(false)}>
                <div className="modal-content" ref={modalRef} onClick={(e) => e.stopPropagation()} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="help-modal-title">
                    <button className="modal-close-btn" onClick={() => setIsHelpModalOpen(false)} aria-label="Close modal">&times;</button>
                    <h2 id="help-modal-title"><i className='bx bx-help-circle'></i> Help & Features</h2>
                    <div className="modal-body">
                        <div dangerouslySetInnerHTML={{ __html: marked.parse(getHelpContent()) as string }} />
                    </div>
                </div>
            </div>
        )}

        {isTodoModalOpen && (
            <div className="modal-overlay" onClick={() => setIsTodoModalOpen(false)}>
                <div className="modal-content" ref={modalRef} onClick={(e) => e.stopPropagation()} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="todo-modal-title">
                    <button className="modal-close-btn" onClick={() => setIsTodoModalOpen(false)} aria-label="Close modal">&times;</button>
                    <h2 id="todo-modal-title"><i className='bx bx-list-check'></i> To-Do List</h2>
                    <div className="modal-body">
                        <form className="todo-add-form" onSubmit={handleTodoFormSubmit}>
                            <input type="text" value={newTodoText} onChange={(e) => setNewTodoText(e.target.value)} placeholder="Add a new task..." />
                            <button type="submit" aria-label="Add task"><i className='bx bx-plus'></i></button>
                        </form>
                        {todos.length > 0 ? (
                            <ul className="todo-list">
                                {todos.map(todo => (
                                    <li key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
                                        <input type="checkbox" checked={todo.completed} onChange={() => handleToggleTodo(todo.id)} aria-labelledby={`todo-text-${todo.id}`} />
                                        <span id={`todo-text-${todo.id}`} className="todo-text">{todo.text}</span>
                                        <button className="todo-delete-btn" onClick={() => handleDeleteTodo(todo.id)} aria-label={`Delete task: ${todo.text}`}><i className='bx bx-trash'></i></button>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="todo-empty-message">Your to-do list is empty. Add a task above!</p>}
                    </div>
                </div>
            </div>
        )}
        
        {selectedImageForModal && (
            <div className="image-modal-overlay" onClick={() => setSelectedImageForModal(null)}>
                <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
                    <button className="modal-close-btn" onClick={() => setSelectedImageForModal(null)}>&times;</button>
                    <img src={selectedImageForModal} alt="Enlarged generated" />
                    <div className="modal-footer">
                        <a href={selectedImageForModal} download={`jura-generated-image-${Date.now()}.png`} className="modal-action-btn primary">
                            <i className='bx bxs-download'></i> Download
                        </a>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}