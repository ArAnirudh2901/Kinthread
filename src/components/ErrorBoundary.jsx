'use client';
import { Component } from 'react';

// Keeps one broken part from blanking the page: renders `fallback` instead and lets the visitor try again.
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('[Kinthread]', error); }
  componentDidUpdate(prev) { if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false }); }
  render() {
    if (!this.state.failed) return this.props.children;
    return this.props.fallback ?? null;
  }
}
