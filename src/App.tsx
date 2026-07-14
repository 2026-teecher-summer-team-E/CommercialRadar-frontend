import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import { RequireAuth, RequireAdmin } from "./lib/auth";
import PageLoader from "./components/common/PageLoader";
import RouteErrorBoundary from "./components/common/RouteErrorBoundary";
// 첫 진입 라우트(비로그인 시 "/"에서 리다이렉트되는 랜딩 페이지)는 첫 화면 깜빡임을 피하기 위해 정적 import 유지.
import LandingPage from "./pages/LandingPage";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const MapPage = lazy(() => import("./pages/MapPage"));
const ComparePage = lazy(() => import("./pages/ComparePage"));
const MyPage = lazy(() => import("./pages/MyPage"));
const RankingPage = lazy(() => import("./pages/RankingPage"));
const TrendsPage = lazy(() => import("./pages/TrendsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const SignInPage = lazy(() => import("./pages/SignInPage"));
const SignUpPage = lazy(() => import("./pages/SignUpPage"));
const GangnamCafeDemoPage = lazy(() => import("./pages/GangnamCafeDemoPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

/** 앱 내부 페이지: 인증 가드 + 사이드바 레이아웃 공유. */
function appRoute(node: React.ReactNode) {
  return (
    <RequireAuth>
      <AppLayout>{node}</AppLayout>
    </RequireAuth>
  );
}

/** 어드민 전용 페이지: 인증 + 어드민 가드 + 사이드바 레이아웃. */
function adminRoute(node: React.ReactNode) {
  return (
    <RequireAuth>
      <RequireAdmin>
        <AppLayout>{node}</AppLayout>
      </RequireAdmin>
    </RequireAuth>
  );
}

function App() {
  return (
    <BrowserRouter useTransitions={false}>
      <RouteErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* 공개 라우트 */}
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/sign-in/*" element={<SignInPage />} />
            <Route path="/sign-up/*" element={<SignUpPage />} />
            {/* 딥러닝(강남역 카페) 예측 데모 */}
            <Route path="/demo/gangnam-cafe" element={<GangnamCafeDemoPage />} />

            {/* 앱 내부(가드 + 사이드바) */}
            <Route path="/" element={appRoute(<MapPage />)} />
            <Route path="/dashboard/:districtCode" element={appRoute(<DashboardPage />)} />
            <Route path="/compare" element={appRoute(<ComparePage />)} />
            <Route path="/ranking" element={appRoute(<RankingPage />)} />
            <Route path="/trends" element={appRoute(<TrendsPage />)} />
            <Route path="/admin" element={adminRoute(<AdminPage />)} />
            <Route path="/mypage" element={appRoute(<MyPage />)} />

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
