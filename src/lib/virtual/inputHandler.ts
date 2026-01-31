"use client";

import { useEffect, useState, useRef, useContext } from 'react';
import { VirtualCtx } from '@/components/virtual/VirtualViewportProvider';

type InputEvent =
  | { type: 'keydown'; key: string; windowId: string; timestamp: number; }
  | { type: 'keyup'; key: string; windowId: string; timestamp: number; }
  | { type: 'mousedown'; button: number; x: number; y: number; windowId: string; timestamp: number; }
  | { type: 'mouseup'; button: number; x: number; y: number; windowId: string; timestamp: number; }
  | { type: 'mousemove'; x: number; y: number; windowId: string; timestamp: number; }
  | { type: 'wheel'; deltaX: number; deltaY: number; deltaZ: number; x: number; y: number; windowId: string; timestamp: number; }
  | { type: 'mouseenter'; x: number; y: number; windowId: string; timestamp: number; }
  | { type: 'mouseleave'; x: number; y: number; windowId: string; timestamp: number; }
  | { type: 'scroll'; scrollX: number; scrollY: number; windowId: string; timestamp: number; };

const INPUT_CHANNEL = 'virtual-inputs';

export function useVirtualInputs() {
  const ctx = useContext(VirtualCtx);
  const [inputs, setInputs] = useState<InputEvent[]>([]);
  const bcRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    bcRef.current = new BroadcastChannel(INPUT_CHANNEL);
    bcRef.current.onmessage = (ev) => {
      const input: InputEvent = ev.data;
      setInputs(prev => [...prev, input]);
    };

    const windowId = ctx?.windowId || 'unknown';
    const viewportOffset = ctx?.viewportOffset || { x: 0, y: 0 };

    const handleKeyDown = (e: KeyboardEvent) => {
      const input: InputEvent = {
        type: 'keydown',
        key: e.key,
        windowId,
        timestamp: Date.now(),
      };
      bcRef.current?.postMessage(input);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const input: InputEvent = {
        type: 'keyup',
        key: e.key,
        windowId,
        timestamp: Date.now(),
      };
      bcRef.current?.postMessage(input);
    };

    const handleMouseDown = (e: MouseEvent) => {
      const input: InputEvent = {
        type: 'mousedown',
        button: e.button,
        x: e.clientX + viewportOffset.x,
        y: e.clientY + viewportOffset.y,
        windowId,
        timestamp: Date.now(),
      };
      bcRef.current?.postMessage(input);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const input: InputEvent = {
        type: 'mouseup',
        button: e.button,
        x: e.clientX + viewportOffset.x,
        y: e.clientY + viewportOffset.y,
        windowId,
        timestamp: Date.now(),
      };
      bcRef.current?.postMessage(input);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const input: InputEvent = {
        type: 'mousemove',
        x: e.clientX + viewportOffset.x,
        y: e.clientY + viewportOffset.y,
        windowId,
        timestamp: Date.now(),
      };
      bcRef.current?.postMessage(input);
    };

    const handleWheel = (e: WheelEvent) => {
      const input: InputEvent = {
        type: 'wheel',
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        deltaZ: e.deltaZ,
        x: e.clientX + viewportOffset.x,
        y: e.clientY + viewportOffset.y,
        windowId,
        timestamp: Date.now(),
      };
      bcRef.current?.postMessage(input);
    };

    const handleMouseEnter = (e: MouseEvent) => {
      const input: InputEvent = {
        type: 'mouseenter',
        x: e.clientX + viewportOffset.x,
        y: e.clientY + viewportOffset.y,
        windowId,
        timestamp: Date.now(),
      };
      bcRef.current?.postMessage(input);
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const input: InputEvent = {
        type: 'mouseleave',
        x: e.clientX + viewportOffset.x,
        y: e.clientY + viewportOffset.y,
        windowId,
        timestamp: Date.now(),
      };
      bcRef.current?.postMessage(input);
    };

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      const input: InputEvent = {
        type: 'scroll',
        scrollX: target.scrollLeft,
        scrollY: target.scrollTop,
        windowId,
        timestamp: Date.now(),
      };
      bcRef.current?.postMessage(input);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('wheel', handleWheel);
    window.addEventListener('mouseenter', handleMouseEnter);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('scroll', handleScroll, true); // true für capture

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mouseenter', handleMouseEnter);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('scroll', handleScroll, true);
      bcRef.current?.close();
    };
  }, [ctx?.windowId, ctx?.viewportOffset]);

  return inputs;
}