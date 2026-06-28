import React from 'react';
import { motion } from 'framer-motion';

interface WordCloudProps {
  words: { text: string; size: number; color?: string }[];
  width?: number;
  height?: number;
}

const WordCloud: React.FC<WordCloudProps> = ({ words, width = 200, height = 120 }) => {
  return (
    <div
      style={{
        width: width,
        height: height,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {words.map((word, index) => {
        const x = Math.random() * (width * 0.8) - (width * 0.4); // Centered random X
        const y = Math.random() * (height * 0.8) - (height * 0.4); // Centered random Y
        const rotation = Math.random() * 30 - 15; // -15 to 15 degrees
        const scale = 0.8 + Math.random() * 0.4; // 0.8 to 1.2

        return (
          <motion.span
            key={index}
            initial={{ opacity: 0, scale: 0.5, x, y, rotate: rotation }}
            animate={{ opacity: 1, scale, x, y, rotate: rotation }}
            transition={{
              duration: 1.5, // Slower for a more organic feel
              delay: index * 0.1, // Staggered entry
              ease: "easeOut",
              type: "spring",
              damping: 10, // Less bounce
              stiffness: 80, // Softer movement
            }}
            style={{
              position: 'absolute',
              whiteSpace: 'nowrap',
              fontSize: word.size,
              color: word.color || 'rgba(255, 255, 255, 0.8)', // Default to white
              fontWeight: 700,
              textShadow: '0 0 8px rgba(0, 240, 255, 0.4)', // Subtle glow
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {word.text}
          </motion.span>
        );
      })}
    </div>
  );
};

export default WordCloud;