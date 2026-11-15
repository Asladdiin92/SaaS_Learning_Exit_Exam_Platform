import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../shared/theme';
import { api } from '../../../shared/api/client';
import {
  ArrowLeft,
  ShoppingBag,
  CheckCircle2,
  Sparkles,
  Download,
  HardDrive,
  Target,
  ArrowRight,
  Shield,
  Tag,
} from 'lucide-react-native';

export interface ProductItem {
  product_id: string;
  code: string;
  title: string;
  is_recurring: boolean;
  billing_interval_days: number | null;
  price_amount: number;
  currency: string;
  entitlement_spec: {
    scope_type?: string;
    offline_download_allowed?: boolean;
    storage_quota_mb?: number;
    ai_monthly_quota?: number;
    features?: string[];
  };
  is_active: boolean;
}

export const StoreCatalogScreen: React.FC = () => {
  const { colors, typography, spacing } = useTheme();
  const navigation = useNavigation<any>();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'SUBSCRIPTIONS' | 'BUNDLES'>('SUBSCRIPTIONS');
  const [products, setProducts] = useState<ProductItem[]>([]);

  const loadProducts = useCallback(async () => {
    try {
      const data = await api.get<ProductItem[]>('/products');
      if (data && Array.isArray(data)) {
        setProducts(data);
      }
    } catch (err: any) {
      console.warn('Failed to load products catalog:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadProducts();
  };

  const subscriptions = products.filter((p) => p.is_recurring);
  const bundles = products.filter((p) => !p.is_recurring);
  const displayedProducts = activeTab === 'SUBSCRIPTIONS' ? subscriptions : bundles;

  const handleSelectProduct = (product: ProductItem) => {
    navigation.navigate('Checkout', {
      productId: product.product_id,
      productCode: product.code,
      title: product.title,
      amount: product.price_amount,
      currency: product.currency,
      isRecurring: product.is_recurring,
    });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.surface.primary }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      testID="store-catalog-screen"
    >
      {/* Top Nav */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="store-back-btn"
        >
          <ArrowLeft size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[typography.h3, { color: colors.text.primary }]}>
          Study Store & Exam Packs
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Hero Banner */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: colors.surface.card,
            borderColor: colors.border.subtle,
          },
        ]}
      >
        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Text style={[typography.h2, { color: colors.text.primary }]}>
              Accelerate Your Exit Exam Pass
            </Text>
            <Text style={[typography.bodySm, { color: colors.text.secondary, marginTop: 4 }]}>
              Full offline rights, verified past exit exams & AI Step-by-Step explanation.
            </Text>
          </View>
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: '#EEF2FF' },
            ]}
          >
            <Tag size={26} color={colors.brand.primary} />
          </View>
        </View>
      </View>

      {/* Category Tabs */}
      <View
        style={[
          styles.categoryTabsContainer,
          {
            backgroundColor: colors.surface.secondary,
            borderColor: colors.border.subtle,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'SUBSCRIPTIONS' && {
              backgroundColor: colors.surface.card,
              elevation: 2,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
            },
          ]}
          onPress={() => setActiveTab('SUBSCRIPTIONS')}
          testID="tab-subscriptions"
        >
          <Text
            style={[
              typography.labelSm,
              {
                color: activeTab === 'SUBSCRIPTIONS' ? colors.brand.primary : colors.text.secondary,
                fontWeight: activeTab === 'SUBSCRIPTIONS' ? '700' : '500',
              },
            ]}
          >
            Subscriptions ({subscriptions.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'BUNDLES' && {
              backgroundColor: colors.surface.card,
              elevation: 2,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
            },
          ]}
          onPress={() => setActiveTab('BUNDLES')}
          testID="tab-bundles"
        >
          <Text
            style={[
              typography.labelSm,
              {
                color: activeTab === 'BUNDLES' ? colors.brand.primary : colors.text.secondary,
                fontWeight: activeTab === 'BUNDLES' ? '700' : '500',
              },
            ]}
          >
            One-Time Exam Packs ({bundles.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Product Cards List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
          <Text style={[typography.bodyMd, { color: colors.text.secondary, marginTop: 12 }]}>
            Loading catalog...
          </Text>
        </View>
      ) : displayedProducts.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.surface.card, borderColor: colors.border.subtle }]}>
          <ShoppingBag size={28} color={colors.text.muted} />
          <Text style={[typography.bodyMd, { color: colors.text.muted, marginTop: 8 }]}>
            No products available in this category.
          </Text>
        </View>
      ) : (
        displayedProducts.map((product) => {
          const spec = product.entitlement_spec || {};
          const isPopular = product.code === 'SUB-SEMESTER' || product.code === 'BUNDLE-EXIT-2023';

          return (
            <View
              key={product.product_id}
              style={[
                styles.productCard,
                {
                  backgroundColor: colors.surface.card,
                  borderColor: isPopular ? colors.brand.primary : colors.border.subtle,
                  borderWidth: isPopular ? 2 : 1,
                },
              ]}
              testID={`product-card-${product.code}`}
            >
              {isPopular && (
                <View style={[styles.popularBadge, { backgroundColor: colors.brand.primary }]}>
                  <Text style={[typography.labelSm, { color: '#FFFFFF', fontWeight: '700' }]}>
                    RECOMMENDED
                  </Text>
                </View>
              )}

              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.h2, { color: colors.text.primary }]}>
                    {product.title}
                  </Text>
                  <Text style={[typography.labelSm, { color: colors.text.muted, marginTop: 2 }]}>
                    Code: {product.code}
                  </Text>
                </View>
                <View style={styles.priceContainer}>
                  <Text style={[typography.h1, { color: colors.brand.primary }]}>
                    {Math.round(product.price_amount)} {product.currency}
                  </Text>
                  <Text style={[typography.labelSm, { color: colors.text.muted }]}>
                    {product.is_recurring ? `every ${product.billing_interval_days} days` : 'one-time'}
                  </Text>
                </View>
              </View>

              {/* Features List */}
              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <CheckCircle2 size={16} color={colors.status.online} />
                  <Text style={[typography.bodySm, { color: colors.text.secondary, marginLeft: 8 }]}>
                    {spec.offline_download_allowed ? 'Full Offline Course & Exam Downloads' : 'Online Practice Access'}
                  </Text>
                </View>

                <View style={styles.featureItem}>
                  <HardDrive size={16} color={colors.brand.primary} />
                  <Text style={[typography.bodySm, { color: colors.text.secondary, marginLeft: 8 }]}>
                    {spec.storage_quota_mb || 2048} MB Encrypted Local Storage
                  </Text>
                </View>

                <View style={styles.featureItem}>
                  <Sparkles size={16} color="#D946EF" />
                  <Text style={[typography.bodySm, { color: colors.text.secondary, marginLeft: 8 }]}>
                    {spec.ai_monthly_quota || 50} Grounded AI Tutor Explanations
                  </Text>
                </View>

                <View style={styles.featureItem}>
                  <Target size={16} color="#EA580C" />
                  <Text style={[typography.bodySm, { color: colors.text.secondary, marginLeft: 8 }]}>
                    Timed Simulations with Sub-16ms Server Scoring
                  </Text>
                </View>
              </View>

              {/* Purchase CTA */}
              <TouchableOpacity
                style={[styles.checkoutBtn, { backgroundColor: colors.brand.primary }]}
                onPress={() => handleSelectProduct(product)}
                activeOpacity={0.8}
                testID={`checkout-btn-${product.code}`}
              >
                <Text style={[typography.h3, { color: '#FFFFFF', fontWeight: '700' }]}>
                  Continue to Checkout
                </Text>
                <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    minHeight: 48,
  },
  backBtn: {
    padding: 6,
  },
  heroCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroText: {
    flex: 1,
    marginRight: 12,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTabsContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: 3,
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    minHeight: 40,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceContainer: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  featuresList: {
    marginVertical: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    minHeight: 48,
    marginTop: 6,
  },
});
