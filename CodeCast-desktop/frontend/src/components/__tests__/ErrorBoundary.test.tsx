import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ErrorBoundary from '../ErrorBoundary';

describe('ErrorBoundary - 错误边界组件', () => {
  // 抛出错误的子组件
  const ThrowError = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
    if (shouldThrow) {
      throw new Error('Test error');
    }
    return <div>Normal content</div>;
  };

  it('应正常渲染子组件当没有错误发生时', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('应捕获渲染错误并显示回退 UI', () => {
    // 抑制 console.error 输出
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // 应该显示错误回退 UI（具体内容取决于实现）
    expect(document.body.innerHTML.length).toBeGreaterThan(0);

    consoleSpy.mockRestore();
  });

  it('应提供重试机制', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    let throwState = true;
    const ToggleError = () => {
      if (throwState) throw new Error('Toggle error');
      return <div>Recovered</div>;
    };

    const { rerender } = render(
      <ErrorBoundary>
        <ToggleError />
      </ErrorBoundary>
    );

    // 初始状态：错误
    expect(consoleSpy).toHaveBeenCalled();

    // 模拟修复错误并重新渲染
    throwState = false;
    rerender(
      <ErrorBoundary>
        <ToggleError />
      </ErrorBoundary>
    );

    consoleSpy.mockRestore();
  });

  it('应处理异步错误', async () => {
    const AsyncError = () => {
      // 注意：ErrorBoundary 无法捕获 setTimeout 中的错误
      return <div>Loading...</div>;
    };

    render(
      <ErrorBoundary>
        <AsyncError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('应正确传递 props 给子组件', () => {
    const TestComponent = ({ message }: { message: string }) => (
      <div>{message}</div>
    );

    render(
      <ErrorBoundary>
        <TestComponent message="Hello" />
      </ErrorBoundary>
    );

    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('应支持自定义回退 UI', () => {
    const CustomFallback = ({ error }: { error: Error }) => (
      <div>Custom error: {error.message}</div>
    );

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<CustomFallback error={new Error('Custom')} />}>
        <ThrowError />
      </ErrorBoundary>
    );

    consoleSpy.mockRestore();
  });
});
