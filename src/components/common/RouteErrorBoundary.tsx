import { Component, type ReactNode } from "react";
import styles from "./RouteErrorBoundary.module.css";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** 라우트 lazy import 실패(네트워크 오류 등) 시 빈 화면 대신 에러 UI를 보여준다. */
export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("페이지를 불러오지 못했습니다:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.wrap}>
          <p>페이지를 불러오지 못했습니다. 네트워크 연결을 확인해주세요.</p>
          <button type="button" className={styles.button} onClick={() => window.location.reload()}>
            새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
