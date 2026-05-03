# 🧪 Threadly Feature Test Suite

Copy and paste these prompts into your Threadly chat to verify the latest high-performance features.

---

### 📊 1. Visual Engine (Deterministic)
**Goal**: Verify quantity detection and high-fidelity rendering.

*   **Test A (Singular)**: `show me a photo of a Bugatti Mistral`
    *   *Expected*: Exactly 1 large, high-res image card.
*   **Test B (Plural)**: `get me 4 images of futuristic architecture in Tokyo`
    *   *Expected*: A grid of exactly 4 large image cards.
*   **Test C (Gallery)**: `show me a gallery of deep sea creatures`
    *   *Expected*: 5-6 images in a scrollable or grid view.

---

### 🧜‍♂️ 2. Mermaid Diagrams
**Goal**: Verify real-time diagram rendering.

*   **Prompt**: `Create a Mermaid sequence diagram showing the process of a user requesting an image, the backend detecting intent, fetching from Pexels, and streaming metadata to the frontend.`

---

### 🔢 3. Mathematical Rendering (LaTeX)
**Goal**: Verify KaTeX integration.

*   **Prompt**: `Explain the Black-Scholes formula and show the full equation in LaTeX block format, along with the inline definition of 'd1'.`

---

### 🐍 4. Python Sandbox
**Goal**: Verify the interactive code execution environment.

*   **Prompt**: `Write a Python script that generates a Fibonacci sequence up to the 100th term and prints only the prime numbers within that sequence.`

---

### 🧠 5. Long-Term Memory
**Goal**: Verify conservative, tag-based memory persistence.

*   **Prompt**: `Remember this fact: my favorite car brand is Bugatti and I prefer the W16 engine architecture. [TAG: favorite_car]`
    *   *Then in a new session*: `What is my favorite car and what engine does it have?`

---

### 🌓 6. Theme & Contrast
**Goal**: Verify "Apple-style" legibility.

*   **Action**: Toggle between **Light**, **Dark**, and **Auto** modes while viewing any of the above results. 
*   *Expected*: Zero "white-on-white" or "black-on-black" text. Sidebars should be pure black (#000000) in dark mode.

---

### 📋 7. Data Tables
**Goal**: Verify premium table styling.

*   **Prompt**: `Create a comparison table between the Bugatti Chiron, Veyron, and Bolide, including Top Speed, Horsepower, and Production Numbers.`
