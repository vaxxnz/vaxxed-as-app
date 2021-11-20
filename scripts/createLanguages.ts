/* eslint-disable camelcase */
import fsExtra from "fs-extra";
import prettier from "prettier";
import JsonToTS from "@riku/json-to-ts";

const { readdirSync, outputJSON, readJSON, outputFile } = fsExtra;

const LOCALES_FOLDER = "./locales";
const JSON_OUTPUT_OPTIONS = { spaces: 2 };
const RTL_LANGUAGES = ["ar", "fa", "he", "ps", "ur", "sd"];

type Header = {
  "Scan your NZ COVID pass": string;
};

type ThisLanguage = {
  name: string;
  callToAction: string;
};

type Translation = {
  language: string;
  header: Header;
  thisLanguage: ThisLanguage;
  isRTL: boolean;
};

const createLanguages = async (): Promise<void> => {
  const languages: string[] = readdirSync(LOCALES_FOLDER);
  const prettierOptions = await readJSON("./.prettierrc");

  const locales = await Promise.all(
    languages.map(async (language: string, index) => {
      const locale = await readJSON(
        `${LOCALES_FOLDER}/${language}/translation.json`
      );
      if (index === 0) {
        const enums = languages
          .map(
            language =>
              `${
                language.includes("-") ? `"${language}"` : language
              } = "${language}"`
          )
          .join(",\n");
        const toTypes = JsonToTS(locale)
          .map(typeInterface => `${typeInterface}`)
          .join("\n\n")
          .replace("RootObject", "Translation")
          .replace(/interface/gi, "export type")
          .replace(/{/gi, "= {");

        const template = `/* eslint-disable no-use-before-define */
        
        export enum Locale {
          ${enums}
        }

        export type Locales = {
          [key in Locale]: Translation;
        };

        ${toTypes}
        `;

        const types = prettier.format(template, {
          parser: "typescript",
          ...prettierOptions
        });

        await outputFile("./src/data/types.ts", types);
      }

      return { [language]: locale };
    })
  )
    .then(result => result.reduce((acc, cur) => ({ ...acc, ...cur }), {}))
    .then(
      result =>
        `import type { Locales } from "./types";
        
        const locales: Locales = ${JSON.stringify(
          result,
          null,
          2
        )};\nexport { locales };`
    )
    .then(result =>
      prettier.format(result, { parser: "typescript", ...prettierOptions })
    );

  await outputFile("./src/data/locales.ts", locales);

  const translations: Translation[] = await Promise.all(
    languages.map(async (language: string) => {
      const { header, thisLanguage } = await readJSON(
        `${LOCALES_FOLDER}/${language}/translation.json`
      );
      const isRTL = RTL_LANGUAGES.includes(language);
      return { header, thisLanguage, language, isRTL };
    })
  );

  const languageOptions = translations.map(
    ({ thisLanguage: { name, callToAction }, language, isRTL, header }) => {
      const option = {
        value: language,
        name,
        callToAction,
        isRTL,
        changeLanguage: header["Change language"]
      };
      return option;
    }
  );

  await outputJSON(
    "./src/data/languageOptions.json",
    languageOptions,
    JSON_OUTPUT_OPTIONS
  );
};

createLanguages();
