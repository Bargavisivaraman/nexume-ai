import { Component } from "react";

/**
 * One crashing tab must not white-screen the whole app. Wrap each tab's
 * content; pass the active tab id as resetKey so switching tabs clears a
 * previous crash.
 */
export default class TabErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("[TabErrorBoundary]", error, info?.componentStack);
  }
  componentDidUpdate(prevProps) {
    // Reset when the user switches tabs so a crash in one tab doesn't stick
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="tab-crash-card">
          <div className="tab-crash-emoji">😵‍💫</div>
          <h3>Something broke on this tab</h3>
          <p>The rest of the app is fine. Try refreshing, or switch tabs and come back.</p>
          <button className="analyze-btn" onClick={() => window.location.reload()}>Refresh</button>
        </div>
      );
    }
    return this.props.children;
  }
}
