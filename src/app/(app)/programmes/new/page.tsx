import { ProgrammeForm } from "@/components/programmes/programme-form";

export default function NewProgrammePage() {
  return (
    <ProgrammeForm
      initial={{
        title: "",
        description: "",
        sections: [{ title: "", items: [{ text: "" }] }],
      }}
    />
  );
}
