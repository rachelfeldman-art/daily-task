import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('React Error Boundary:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', { className: 'min-h-screen flex items-center justify-center p-8 text-center' },
        React.createElement('div', null,
          React.createElement('h2', { className: 'text-xl font-bold text-[#2D2A26] mb-2' }, 'Something went wrong'),
          React.createElement('p', { className: 'text-[#6B6560] mb-4' }, this.state.error?.message),
          React.createElement('button', {
            onClick: () => this.setState({ hasError: false, error: null }),
            className: 'px-4 py-2 bg-[#4F7C59] text-white rounded-xl'
          }, 'Try Again')
        )
      );
    }
    return this.props.children;
  }
}
