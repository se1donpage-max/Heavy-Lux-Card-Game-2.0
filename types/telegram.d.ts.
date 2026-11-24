export {};

declare global {
  interface Window {
    Telegram?: { WebApp?: {
      initData?: string;
      ready?: () => void;
      expand?: () => void;
      isVersionAtLeast?: (version: string) => boolean;
      setHeaderColor?: (color: string) => void;
      setBackgroundColor?: (color: string) => void;
      setBottomBarColor?: (color: string) => void;
      viewportStableHeight?: number;
      onEvent?: (name: string, callback: () => void) => void;
      offEvent?: (name: string, callback: () => void) => void;
    } };
  }
}
