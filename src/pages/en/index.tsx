import HomeLanding from "@/components/landing/HomeLanding";
import Seo from "@/components/Seo";

export default function HomeEn() {
  return (
    <>
      <Seo
        title="FitPlan AI | AI-Powered Nutrition and Training Plans"
        description="Build your personalised nutrition and training plan with AI: weekly meal plans with exact ingredients, gym routines, macro targets and progress tracking."
        path="/en"
        esPath="/"
        enPath="/en"
        locale="en"
      />
      <HomeLanding locale="en" />
    </>
  );
}
