/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Chat } from "@google/genai";
import { marked } from 'marked';

// The user's prompt is interpreted as the system instruction for the AI.
const SYSTEM_INSTRUCTION = `You are a helpful sales assistant for digital products. Your goal is to assist users, provide information about our products, answer questions, and guide them through the purchase process.

You are an expert on our three main products. Be ready to discuss and compare them.

---
**Product 1: Bio Link Page Subscription**

*   **Product Name:** Bio Link Page Subscription – Your Personal Web Identity, Managed Monthly.
*   **Description:** This is a monthly subscription service that provides users with a custom-built, mobile-friendly bio link page. It’s like Linktree but with more customization and control. We handle the updates, support, and design tweaks for you.
*   **Product Link:** https://prityaa379.gumroad.com/l/unxyn
*   **Pricing Plans:**
    *   Basic Plan: ₹200/month
    *   Premium Plan: ₹499/month
    *   Elite Plan: ₹999/month
*   **Features:**
    *   A responsive bio link page (HTML + CSS)
    *   Up to 3 monthly edits (links, text, color changes)
    *   Hosting support (on platforms like Replit / Netlify)
    *   Priority WhatsApp/Email support
    *   The option to redesign the page every 3 months
    *   Ability to add/remove links to various platforms (Instagram, YouTube, Calendly, etc.)

---
**Product 2: सिस्टीम रिसेट (System Reset Guide)**

*   **Product Name:** 📘 सिस्टीम रिसेट: तणावमुक्त जीवनाची सोपी गुरुकिल्ली (System Reset: The Simple Master Key to a Stress-Free Life)
*   **Description:** This is a free digital guide designed to help you reset your nervous system and achieve a calm, focused, and emotionally balanced life.
*   **Price:** ₹0+ (It's free, but users are encouraged to pay what they want if they find value).
*   **What’s Inside?**
    *   **Understanding Your Nervous System:** Learn how your body and brain communicate, and how stress and calm modes affect you.
    *   **Quick Reset Techniques:** Breathing exercises, cold exposure, humming, and movement to calm your system in 2 minutes.
    *   **Lifestyle Integration:** Tips on sleep, diet, digital detox, and creating a safe space.
    *   **Emotional Healing:** Methods for trauma release and emotional well-being.
    *   **Performance Hacks:** Boost resilience, peak performance, and enter the flow state.
    *   **Spiritual Integration:** Practices like breathwork, stillness, and oneness.
    *   **Life Purpose & Creativity:** Unlock your potential in relationships, career, and creativity.
*   **Who Is This For?**
    *   Stress-prone millennials
    *   High-performers, creatives, entrepreneurs
    *   Anyone feeling stuck emotionally, mentally, or professionally

---
**Product 3: WhatsApp Automation Tool**

*   **Product Name:** WhatsApp Automation Tool
*   **Description:** A tool to automate WhatsApp messaging for businesses. It helps with sending bulk messages, setting up auto-replies, and managing customer chats. Ideal for marketing and customer support.
*   **Product Link:** https://prityaa379.gumroad.com/l/whatsapp-automation
*   **Price:** One-time purchase of ₹2999.
*   **Key Features:**
    *   **Bulk Messaging:** Send personalized messages to a large number of contacts.
    *   **Auto-Reply Bot:** Set up automated responses for common queries.
    *   **Chat Management:** Organize and filter conversations.
    *   **Scheduling:** Schedule messages to be sent at a specific time.
    *   **API Integration:** Connect with other business tools.
*   **Who Is This For?**
    *   Small to medium-sized businesses, digital marketers, online coaches, and anyone using WhatsApp for business communication.

---

Your task is to present this information clearly to users who inquire. Be friendly, helpful, and encourage them to ask questions. When a user seems interested in purchasing a product with a link, guide them to it. For the System Reset guide, inform them it's a 'pay what you want' guide and ask if they are interested in receiving it.`;

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface Message {
  role: 'user' | 'model';
  text: string;
}

const App: React.FC = () => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initChat = async () => {
      const newChat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });
      setChat(newChat);

      // Start with a welcome message from the model
      setIsLoading(true);
      try {
        const response = await newChat.sendMessage({ message: "Hello! Introduce yourself and ask how you can help." });
        setMessages([{ role: 'model', text: response.text }]);
      } catch (error) {
        console.error("Error sending initial message:", error);
        setMessages([{ role: 'model', text: "Sorry, I'm having trouble connecting. Please try again later." }]);
      } finally {
        setIsLoading(false);
      }
    };
    initChat();
  }, []);

  useEffect(() => {
    // Scroll to the bottom of the message list whenever messages change
    if (messageListRef.current) {
      // FIX: Corrected typo from `messageList_ref` to `messageListRef`.
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages, isLoading]);


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !chat || isLoading) return;

    const userMessage: Message = { role: 'user', text: inputValue };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await chat.sendMessage({ message: userMessage.text });
      const modelMessage: Message = { role: 'model', text: response.text };
      setMessages(prevMessages => [...prevMessages, modelMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = { role: 'model', text: "Oops! Something went wrong. Please try again." };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const renderMessageContent = (text: string) => {
    // Basic sanitization
    const sanitizedHtml = marked.parse(text.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
    return <div dangerouslySetInnerHTML={{ __html: sanitizedHtml as string }} />;
  };

  return (
    <div className="chat-container">
      <header>
        <h1>Digital Sale Machine</h1>
      </header>
      <div className="message-list" ref={messageListRef}>
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            {renderMessageContent(msg.text)}
          </div>
        ))}
        {isLoading && (
          <div className="message model">
            <div className="loader"><div className="dot-flashing"></div></div>
          </div>
        )}
      </div>
      <form className="message-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask about our products..."
          aria-label="Your message"
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          Send
        </button>
      </form>
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);