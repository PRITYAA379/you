/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Chat } from '@google/genai';
import { marked } from 'marked';

interface Message {
  role: 'user' | 'model' | 'error';
  content: string;
}

interface CardData {
    name: string;
    link: string;
    colors: string[];
    description: string;
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
    colors: ['#FF90E8', '#FF90E8'],
    description: `**What it is:** Gumroad is an e-commerce platform designed for creators to sell digital products directly to their audience. It's incredibly simple to use, handling payments, file hosting, and delivery.\n\n**How to sell digital stuff:** You can sell almost any digital file: PDFs, audiobooks, video courses, software licenses, design assets, and more. Create your product, upload the file, set a price (or let customers pay what they want), and share the link. Gumroad makes selling your first digital product incredibly easy and free to start.`
  },
  { 
    name: 'GitHub', 
    link: 'https://github.com/', 
    colors: ['#333', '#6e5494'],
    description: `**What it is:** GitHub is a platform for version control and collaboration, primarily used for software development. It allows developers to host and review code, manage projects, and build software together.\n\n**How to use it for digital products:** While not a direct sales platform, you can host code for software you sell elsewhere (like Gumroad). You can also use GitHub Sponsors to get funding from users who love your open-source projects. It's the standard for creating and sharing code-based products.`
  },
  { 
    name: 'CodePen', 
    link: 'https://codepen.io/', 
    colors: ['#000000', '#AEAEAE'],
    description: `**What it is:** CodePen is an online social development environment for front-end designers and developers. It's a place to build and deploy a website, show off your work, build test cases, and find inspiration.\n\n**How to use it for digital products:** You can sell complex code snippets or web components. Create a beautiful animation or a useful UI element, and link to a purchase page on Gumroad. It's a great way to showcase your skills and monetize your front-end creations.`
  },
  { 
    name: 'ChatGPT', 
    link: 'https://chat.openai.com/', 
    colors: ['#74AA9C', '#74AA9C'],
    description: `**What it is:** ChatGPT is a powerful language model developed by OpenAI. It can understand and generate human-like text, making it a versatile tool for a wide range of tasks.\n\n**How to use it for digital products:** Similar to Google AI Studio, use it to create content for your digital products. Write chapters for an e-book, generate ideas for a video course, create social media posts, or even get help writing the description for your Gumroad product page. The free version is incredibly powerful for content creation.`
  },
  { 
    name: 'Grok', 
    link: 'https://grok.x.ai/', 
    colors: ['#000000', '#1DA1F2'],
    description: `**What it is:** Grok is a conversational AI developed by xAI. It's designed to have a bit of wit and a rebellious streak, and has real-time access to information via the X (formerly Twitter) platform.\n\n**How to use it for digital products:** Use Grok for market research and trend analysis by tapping into real-time conversations on X. It can help you understand what topics are buzzing, generate edgy marketing copy, and come up with unique, timely ideas for digital products that are relevant to current events.`
  },
];

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      content: "Hello! I'm the DigitalConfVisions assistant. How can I help you strategize today?",
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chat, setChat] = useState<Chat | null>(null);
  const [ai, setAi] = useState<GoogleGenAI | null>(null);

  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState('en-US');
  const [translatedContent, setTranslatedContent] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [vibrate, setVibrate] = useState(false);

  const messageListRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    try {
      const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      setAi(genAI);
      const chatInstance = genAI.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: 'You are the DigitalConfVisions chatbot, a friendly and expert assistant for digital strategy, technology, and innovation. Provide clear, concise, and helpful answers.',
        },
      });
      setChat(chatInstance);
    } catch (error) {
        console.error("Failed to initialize GoogleGenAI:", error);
        setMessages(prev => [...prev, { role: 'error', content: 'Failed to initialize AI. Please check the API key and configuration.' }]);
    }
  }, []);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || !chat) return;

    const userMessage: Message = { role: 'user', content: inputValue };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await chat.sendMessage({ message: inputValue });
      const modelMessage: Message = { role: 'model', content: response.text };
      setMessages((prevMessages) => [...prevMessages, modelMessage]);
    } catch (error) {
      console.error('Gemini API error:', error);
      const errorMessage: Message = { role: 'error', content: 'Sorry, something went wrong. Please try again.' };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const translateContent = async (text: string, lang: string) => {
      if (!ai || lang === 'en-US') {
          setTranslatedContent(text);
          return;
      }
      setIsTranslating(true);
      try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Translate the following text to ${lang}. Keep the markdown formatting (like **bold text** and newlines): \n\n${text}`,
          });
          setTranslatedContent(response.text);
      } catch (error) {
          console.error("Translation error:", error);
          setTranslatedContent("Sorry, translation failed. Please try again.");
      } finally {
          setIsTranslating(false);
      }
  };

  const handleCardClick = (card: CardData) => {
    setSelectedCard(card);
    setTranslatedContent(card.description);
    if(currentLanguage !== 'en-US') {
        translateContent(card.description, currentLanguage);
    }
  };

  const handleCloseModal = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setSelectedCard(null);
    setTranslatedContent('');
    setCurrentLanguage('en-US'); // Reset language on close
  };
  
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newLang = e.target.value;
      setCurrentLanguage(newLang);
      if (selectedCard) {
          translateContent(selectedCard.description, newLang);
      }
  };
  
  const handleListen = () => {
      if (isSpeaking) {
          window.speechSynthesis.cancel();
          setIsSpeaking(false);
          return;
      }
      if (translatedContent) {
          const utterance = new SpeechSynthesisUtterance(translatedContent.replace(/\*\*/g, '')); // Remove markdown for better speech
          utterance.lang = currentLanguage;
          utterance.onend = () => setIsSpeaking(false);
          window.speechSynthesis.speak(utterance);
          setIsSpeaking(true);
      }
  };
  
  const handleStartLearningClick = () => {
    setVibrate(true);
    setTimeout(() => setVibrate(false), 500);
  };

  const renderMessageContent = (content: string) => {
    const rawHtml = marked.parse(content);
    return <div dangerouslySetInnerHTML={{ __html: rawHtml as string }} />;
  };
  
  // Keyboard accessibility for modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseModal();
      }
    };
    if (selectedCard) {
      document.addEventListener('keydown', handleKeyDown);
      modalRef.current?.focus();
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedCard]);


  return (
    <div className="app-container">
      <header>
        <div className="header-left">
          <svg className="logo-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 20 H80 V80 H20 Z" stroke="white" strokeWidth="8" />
            <path d="M35 35 H65 V65 H35 Z" stroke="white" strokeWidth="6" opacity="0.7" />
          </svg>
          <h1>DIGITALCONFVISIONS</h1>
        </div>
         <div className="header-right">
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
        <section className="chat-container">
          <div className="message-list" ref={messageListRef}>
            {messages.map((msg, index) => (
              <div key={index} className={`message-wrapper ${msg.role}-wrapper`}>
                <div className={`message-bubble ${msg.role}-bubble`}>
                  {renderMessageContent(msg.content)}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message-wrapper model-wrapper">
                <div className="message-bubble model-bubble">
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <form className="message-input-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask anything..."
              aria-label="Chat input"
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !inputValue.trim()} aria-label="Send message">
               <i className='bx bxs-send'></i>
            </button>
          </form>
        </section>

        <section className="content-section">
            <h2>
                JOIN US TODAY AND START LEARNING digitally with pdfs audio books and short video guides.
            </h2>
        </section>
        
        <section 
          className="card-grid"
          role="region"
          aria-label="Learning platforms"
        >
          {cardData.map((card, index) => (
            <button 
                key={index} 
                className="card"
                onClick={() => handleCardClick(card)}
                style={{
                    '--bg1': card.colors[0], 
                    '--bg2': card.colors[1] || card.colors[0],
                    animationDelay: `${index * 0.15}s`
                } as React.CSSProperties}
                aria-label={`Learn more about ${card.name}`}
            >
                <h3>{card.name}</h3>
            </button>
          ))}
        </section>
      </main>

      <footer>
          <a
            href="https://calendly.com/jagtappritam73/book-your-slot"
            target="_blank"
            rel="noopener noreferrer"
            className="cta-button"
          >
            Book a Call
          </a>
      </footer>

      {selectedCard && (
        <div className="modal-overlay" onClick={handleCloseModal}>
            <div 
                className="modal-content" 
                onClick={(e) => e.stopPropagation()}
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                aria-describedby="modal-description"
                tabIndex={-1}
            >
                <button className="modal-close-btn" onClick={handleCloseModal} aria-label="Close modal">&times;</button>
                <h2 id="modal-title">{selectedCard.name}</h2>
                <div id="modal-description" className="modal-body">
                    {isTranslating ? (
                        <div className="typing-indicator"><span></span><span></span><span></span></div>
                    ) : (
                        renderMessageContent(translatedContent)
                    )}
                </div>
                <div className="modal-footer">
                    <button className="modal-action-btn" onClick={handleListen} disabled={isTranslating}>
                        {isSpeaking ? 'Stop' : 'Listen'}
                    </button>
                    <button className="modal-action-btn" onClick={handleStartLearningClick}>
                        I want to start learning now
                    </button>
                    <a 
                        href="https://calendly.com/jagtappritam73/book-your-slot" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className={`modal-action-btn primary ${vibrate ? 'vibrate' : ''}`}
                    >
                        Book Call with PRITYAA379
                    </a>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);