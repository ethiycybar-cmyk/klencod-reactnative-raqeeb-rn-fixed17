import { useWindowDimensions } from 'react-native';

/** تجاوب الهاتف/التابلت: أعمدة القوائم وأقصى عرض للمحتوى. */
export function useResponsive() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 720;
  const columns = width >= 1040 ? 3 : isTablet ? 2 : 1;
  const maxWidth = isTablet ? 1080 : width;
  return { width, isTablet, columns, maxWidth };
}
