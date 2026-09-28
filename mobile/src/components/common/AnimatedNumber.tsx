import React, { useEffect, useRef, useState } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  formatter?: (val: number) => string;
  style?: StyleProp<TextStyle>;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 900,
  prefix = '',
  suffix = '',
  decimals = 0,
  formatter,
  style,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const targetValueRef = useRef(value);

  useEffect(() => {
    targetValueRef.current = value;
    startTimeRef.current = null;
    const startVal = 0;
    const endVal = Number(value) || 0;

    if (endVal === 0) {
      setDisplayValue(0);
      return;
    }

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * eased;

      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endVal);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [value, duration]);

  const formatNumber = (num: number) => {
    if (formatter) return formatter(num);
    const fixed = decimals > 0 ? num.toFixed(decimals) : Math.round(num).toString();
    // Add comma formatting for thousands
    const parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  return (
    <Text style={style}>
      {prefix}
      {formatNumber(displayValue)}
      {suffix}
    </Text>
  );
};
