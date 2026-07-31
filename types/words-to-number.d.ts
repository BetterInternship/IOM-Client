declare module "words-to-number" {
  type ConversionResult = {
    status: "success" | "failure";
    value?: number;
  };

  type WordsToNumber = {
    fast(input: string): ConversionResult;
  };

  const wordsToNumber: WordsToNumber;
  export = wordsToNumber;
}
