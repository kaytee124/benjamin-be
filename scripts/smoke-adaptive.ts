import {
  buildMathForm,
  countDomainsInForm,
  countTemplatesInForm,
  BASE_TEMPLATE_CAP,
  WEAK_TOPIC_CAP,
} from "../src/data/templates/buildForm";

const fresh = buildMathForm({ seed: 7, attemptCount: 0 });
const d0 = countDomainsInForm(fresh.questions);
const max0 = Math.max(...countTemplatesInForm(fresh.questions).values());

const weak = buildMathForm({
  seed: 11,
  attemptCount: 10,
  topicWeaknesses: [
    { topic: "angles", accuracy: 0.2, flagged: true },
    { topic: "graphs", accuracy: 0.3, flagged: true },
  ],
});
const neutral = buildMathForm({ seed: 11, attemptCount: 10 });

console.log(
  JSON.stringify(
    {
      fresh: { ...d0, maxRepeat: max0 },
      weak: {
        ...countDomainsInForm(weak.questions),
        angles: weak.questions.filter((q) => q.topic === "angles").length,
        graphs: weak.questions.filter((q) => q.topic === "graphs").length,
        maxRepeat: Math.max(...countTemplatesInForm(weak.questions).values()),
      },
      neutralSameSeed: {
        angles: neutral.questions.filter((q) => q.topic === "angles").length,
        graphs: neutral.questions.filter((q) => q.topic === "graphs").length,
      },
      caps: { BASE_TEMPLATE_CAP, WEAK_TOPIC_CAP },
    },
    null,
    2
  )
);
