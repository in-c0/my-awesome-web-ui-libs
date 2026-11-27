'use client';

import { Component, type ReactNode } from 'react';

interface ShaderErrorBoundaryProps {
  children: ReactNode;
}

/**
 * The CSS layer remains visible if a third-party shader throws during React rendering.
 * Error recovery happens when the parent mounts a new effect.
 */
export class ShaderErrorBoundary extends Component<ShaderErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
