import type { MotionProps } from "framer-motion"

const smoothEase: [number, number, number, number] = [0.22, 1, 0.36, 1]

export function smoothListItemMotion(index: number, reduceMotion = false): MotionProps {
  const animateEntry = !reduceMotion && index < 12
  const duration = reduceMotion ? 0.01 : 0.14

  return {
    initial: animateEntry ? { opacity: 0, y: 4 } : false,
    animate: animateEntry ? { opacity: 1, y: 0 } : { opacity: 1 },
    exit: { opacity: 0 },
    style: animateEntry ? { willChange: "opacity, transform" } : undefined,
    transition: {
      duration,
      ease: smoothEase,
    },
  }
}

export function smoothFadeMotion(reduceMotion = false): MotionProps {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: reduceMotion ? 0.01 : 0.18, ease: smoothEase },
  }
}
