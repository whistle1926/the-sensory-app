import { FormBuilder } from "@/components/forms/form-builder";

export default function NewFormPage() {
  return (
    <FormBuilder
      initial={{
        title: "",
        description: "",
        fields: [],
        settings: {
          submitButtonText: "Submit",
          successMessage: "Thanks — we've got your response.",
        },
        isPublished: false,
      }}
    />
  );
}
