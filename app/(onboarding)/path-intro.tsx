import { useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { ScreenWrapper } from "@/components/layout/ScreenWrapper";
import { Button } from "@/components/ui/Button";
import { IconSymbol, type IconSymbolName } from "@/components/ui/icon-symbol";
import { Colors, Spacing, Typography, Radius } from "@/constants/theme";
import { Routes } from "@/constants/routes";

// Same three paths, same order, same colors/icons as focus.tsx's OPTIONS —
// this carousel is the pitch for each path *before* the user has to commit to
// one there, so it needs to read as a continuation of that screen, not a
// different visual language. See design/artifacts/"Path Intro Screens" for
// the original mockup this was built from.
interface Slide {
  key: string;
  tag: string;
  tagColor: string;
  badgeBg: string;
  icon: IconSymbolName;
  headline: string;
  sub: string;
  // Real 3D character art drops in here once available — falls back to the
  // colored icon badge below until then. Swapping art in only ever means
  // setting this field; no layout/copy changes needed.
  image?: ImageSourcePropType;
}

const SLIDES: Slide[] = [
  {
    key: "student",
    tag: "Student",
    tagColor: Colors.primary,
    badgeBg: "#DAE9FC",
    icon: "book.fill",
    headline: "Every class, exam, and deadline — one plan.",
    sub: "AI turns your syllabus and schedule into a day-by-day plan, so nothing slips through.",
    image: require("@/assets/images/IPlanner_Avatar1.png"),
  },
  {
    key: "exam_candidate",
    tag: "Exam candidate",
    tagColor: "#92400E",
    badgeBg: "#FEF3C7",
    icon: "pencil",
    headline: "A revision plan built around your exam date.",
    sub: "Tell us when you sit — AI breaks the syllabus into weekly topics, so you always know what's next.",
    image: require("@/assets/images/IPlanner_Avatar3.png"),
  },
  {
    key: "professional",
    tag: "Professional",
    tagColor: "#065F46",
    badgeBg: "#DCFCE7",
    icon: "briefcase.fill",
    headline: "Certifications and projects, kept on schedule.",
    sub: "AI Coach tracks your goals and deadlines, so career growth doesn't get lost in the day-to-day.",
    image: require("@/assets/images/IPlanner_Avatar2.png"),
  },
];

export default function PathIntro() {
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  // Welcome now comes right after this carousel (not Register directly) —
  // its own "Get started"/"I already have an account" buttons are what
  // actually lead to Register/Login. See app/index.tsx for the full order.
  const goToWelcome = () => router.push(Routes.WELCOME);

  const scrollToIndex = (next: number) => {
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  };

  const handleNext = () => {
    if (index < SLIDES.length - 1) {
      scrollToIndex(index + 1);
    } else {
      goToWelcome();
    }
  };

  // Keeps the dots/CTA in sync when the user swipes instead of tapping Next.
  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(next);
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <ScreenWrapper backgroundColor={Colors.white}>
      <View style={styles.root}>
        <Pressable style={styles.skip} onPress={goToWelcome} hitSlop={10}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumEnd}
          scrollEventThrottle={16}
        >
          {SLIDES.map((slide) => (
            <View key={slide.key} style={[styles.slide, { width }]}>
              {/* Character-forward layout, per the reference inspo: a large
                  illustration dominates the top of the screen, headline/sub
                  sit below it. The soft halo + centered icon is a stand-in
                  for the real 3D art — once `slide.image` is set this whole
                  block becomes just the character floating on its own. */}
              <View style={[styles.artWrap, { height: height * 0.42 }]}>
                {slide.image ? (
                  <Image source={slide.image} style={styles.art} resizeMode="contain" />
                ) : (
                  <View style={[styles.halo, { backgroundColor: slide.badgeBg }]}>
                    <IconSymbol name={slide.icon} color={slide.tagColor} size={72} />
                  </View>
                )}
              </View>

              <View style={styles.textBlock}>
                <Text style={[styles.pathTag, { color: slide.tagColor }]}>
                  {slide.tag.toUpperCase()}
                </Text>
                <Text style={styles.headline}>{slide.headline}</Text>
                <Text style={styles.sub}>{slide.sub}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((slide, i) => (
              <Pressable key={slide.key} onPress={() => scrollToIndex(i)} hitSlop={8}>
                <View style={[styles.dot, i === index && styles.dotOn]} />
              </Pressable>
            ))}
          </View>

          {/* "Continue" not "Get started" on the last slide — this leads into
              Welcome, which has its own "Get started" button; two in a row
              would read as redundant. */}
          <Button label={isLast ? "Continue" : "Next"} onPress={handleNext} style={styles.cta} />
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  skip: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.lg,
    zIndex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  skipText: {
    ...Typography.label,
    color: Colors.textMuted,
  },
  slide: {
    flex: 1,
    paddingTop: Spacing.xxl + Spacing.lg,
  },
  // Fixed height (a % of screen height, set inline above) rather than flex —
  // keeps the character's footprint consistent regardless of how long a
  // given slide's headline/sub run to, so the art never gets crowded out.
  artWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    width: "78%",
    aspectRatio: 1,
    maxWidth: 280,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  art: {
    width: "88%",
    height: "100%",
  },
  textBlock: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    alignItems: "center",
  },
  pathTag: {
    ...Typography.label,
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },
  headline: {
    ...Typography.h1,
    fontSize: 25,
    lineHeight: 31,
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  sub: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: Spacing.lg,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
  },
  dotOn: {
    width: 20,
    backgroundColor: Colors.primary,
  },
  cta: {
    width: "100%",
    borderRadius: Radius.full,
  },
});
