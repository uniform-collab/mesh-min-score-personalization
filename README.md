# Uniform Mesh Integration: Minimum Score Personalization Criteria

This Uniform Mesh Integration provides a custom UI for configuring personalization criteria based on minimum dimension scores. It extends the Uniform dashboard with a specialized criteria editor that allows content authors to create personalization rules using dimension-based scoring thresholds.

## Overview

### What This Integration Does

This integration provides:
- **Custom Criteria Editor UI**: A user-friendly interface for configuring minimum score personalization criteria
- **Dimension Selection**: Grouped dropdown for selecting from Signal, Audience, Intent, Enrichment, and Quirk dimensions
- **Score Threshold Configuration**: Input field for setting minimum score requirements
- **Real-time Data Fetching**: Integration with Uniform's Context API to fetch available dimensions and quirks

### How It Works

1. **Content Authors** use the custom criteria editor in the Uniform dashboard to configure personalization rules
2. **The Integration** provides the UI and saves criteria as structured data (dimension + minimum score)
3. **Your Application** implements a Context plugin that reads these criteria and applies the personalization logic
4. **Visitors** see personalized content based on their dimension scores meeting the configured thresholds

##UI

###Criteria Editor
![Criteria Editor UI](https://raw.githubusercontent.com/uniform-collab/mesh-min-score-personalization/main/public/Criteria%20Editor.png)

### Score Threshold Configuration
![Score Selector](https://raw.githubusercontent.com/uniform-collab/mesh-min-score-personalization/main/public/ScoreSelector.png)



## Installation & Setup

### Prerequisites

- Uniform team with admin access
- Uniform project where you want to use the integration
- Team admin level API key

### Step 1: Deploy the Integration

#### Option A: Using CLI (Recommended)

1. **Setup Environment Variables**
   ```bash
   # Copy the example env file
   cp .env.example .env
   ```
   
   Fill in your `.env` file with:
   ```env
   UNIFORM_API_KEY=your_team_admin_api_key
   UNIFORM_TEAM_ID=your_team_id
   UNIFORM_PROJECT_ID=your_project_id
   NEXT_PUBLIC_UNIFORM_API_KEY=your_api_key
   NEXT_PUBLIC_UNIFORM_PROJECT_ID=your_project_id
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Register Integration to Team**
   ```bash
   npm run register-to-team
   ```

4. **Install Integration to Project**
   ```bash
   npm run install-to-project
   ```

#### Option B: Manual Installation via Uniform Dashboard

1. **Create Integration Definition**
   - Go to your Uniform Team Settings → Custom Integrations
   - Click "Add Custom Integration"
   - Paste the contents of `mesh-manifest.json`
   - Edit the `type` and `displayName` as desired

2. **Install to Project**
   - Go to your Project → Integrations
   - Find your custom integration in the list
   - Click "Install"

### Step 2: Configure Personalization Components

After installing the integration, you can use the minimum score criteria editor in:

- **Personalization Components**: The integration registers a custom selection algorithm called `min-score-best-match`
- **Component Variants**: Use the criteria editor to set dimension and minimum score thresholds
- **Content Authoring**: Authors can select dimensions and set score requirements through the custom UI

## Step 3: Implement the Context Plugin (Required)

⚠️ **Important**: The integration only provides the UI for configuring criteria. To make personalization work in your application, you must implement a Context plugin that processes these criteria.

### Context Plugin Implementation

Create a personalization algorithm plugin in your application:

```typescript
import type {
  PersonalizationSelectionAlgorithm,
  PersonalizedVariant,
} from "@uniformdev/context";

type MinScoreCriteria = {
  minScore?: number;
  dim?: string;
};

type VariantWithDim = PersonalizedVariant<MinScoreCriteria>;

export const pickBestAboveMin = (
  options: Parameters<PersonalizationSelectionAlgorithm<MinScoreCriteria>>[0]
) => {
  const { variations, take = 1, context } = options;

  console.log("=== Min Score Personalization Algorithm Debug ===");
  console.log("context.scores:", context.scores);
  console.log("variations:", variations);
  console.log("take:", take);

  try {
    const variationMatches: Array<{
      variation: VariantWithDim;
      score: number;
      originalIndex: number;
    }> = [];
    const defaultVariations: VariantWithDim[] = [];

    const needsConsentToPersonalize = context.requireConsentForPersonalization;
    const isInGlobalControlGroup = context.storage?.data?.controlGroup ?? false;
    const personalizationAllowed =
      !needsConsentToPersonalize || context.storage?.data?.consent;

    let originalIndex = 0;
    for (const variation of Array.from(variations)) {
      // inspect variant criteria object format to make sure it's legit
      const isInvalidFormat = variation.pz && typeof variation.pz !== "object";

      let validVariation: VariantWithDim;

      if (isInvalidFormat) {
        const { pz, ...validParts } = variation;
        // treat invalid variations as default variations
        validVariation = validParts as VariantWithDim;
      } else {
        validVariation = variation as VariantWithDim;
      }

      if (validVariation.pz?.dim) {
        if (!personalizationAllowed) {
          console.log(
            `Variant ${validVariation.id}: personalization not allowed`
          );
          continue;
        }

        // Get the visitor's score for this dimension
        const score = context.scores[validVariation.pz.dim] ?? 0;
        const minScore = validVariation.pz.minScore ?? 0;

        console.log(`Variant ${validVariation.id}:`, {
          dim: validVariation.pz.dim,
          score,
          minScore,
          passes: score >= minScore,
        });

        // Check if score meets minimum requirement
        if (score < minScore) {
          console.log(
            `Variant ${validVariation.id}: score ${score} below minimum ${minScore}`
          );
          continue;
        }

        // Only include variations with positive scores (like original algorithm)
        if (score <= 0) {
          console.log(
            `Variant ${validVariation.id}: score ${score} is not positive`
          );
          continue;
        }

        // add the variation to the list of matching variations
        variationMatches.push({
          variation: validVariation,
          score,
          originalIndex,
        });
        originalIndex++;
      } else {
        // collect default variations separately (no pz criteria)
        console.log(`Variant ${validVariation.id}: default variation (no pz)`);
        defaultVariations.push(validVariation);
      }
    }

    // Sort by score (highest first), with original index as tie-breaker
    variationMatches.sort((a, b) => {
      // First sort by score (highest first)
      const scoreComparison = b.score - a.score;

      // If scores are equal, fall back to original order (tie-break by originalIndex)
      if (scoreComparison === 0) {
        return a.originalIndex - b.originalIndex;
      }

      return scoreComparison;
    });

    const result: (VariantWithDim & { control: boolean })[] = [];

    for (let i = 0; i < variationMatches.length; i++) {
      const variationMatch = variationMatches[i];

      let variantToAdd: VariantWithDim | undefined = variationMatch.variation;

      if (i >= take) {
        // we've already added the requested number of variations, so we can stop here
        continue;
      }

      if (isInGlobalControlGroup) {
        // if the user is in a control group, we want to swap it out with a default variant
        const defaultReplacement = defaultVariations.shift();

        // if a default variant exists, use it
        if (defaultReplacement) {
          variantToAdd = {
            ...defaultReplacement,
            id: variationMatch.variation.id,
          };
        } else {
          // otherwise set to undefined and do not add this variant to results
          variantToAdd = undefined;
        }
      }

      // if there is a variant to add, add it to the results
      if (variantToAdd) {
        result.push({ ...variantToAdd, control: isInGlobalControlGroup });
      }
    }

    // fill in any remaining slots with default variants
    while (result.length < take && defaultVariations.length) {
      const defaultVariant = defaultVariations.shift()!;
      console.log(`Adding default variant: ${defaultVariant.id}`);
      result.push({ ...defaultVariant, control: false });
    }

    console.log("Final result:", {
      personalized: variationMatches.length > 0 && !isInGlobalControlGroup,
      variations: result.map((v) => ({ id: v.id, control: v.control })),
    });
    console.log("=== End Algorithm Debug ===");

    return {
      personalized: variationMatches.length > 0 && !isInGlobalControlGroup,
      variations: result,
    };
  } catch (error) {
    console.error("Error in personalization algorithm:", error);
    // Fallback to default variations if there's an error
    const fallbackVariations = Array.from(variations)
      .filter((v) => !v.pz?.dim)
      .slice(0, take)
      .map((v) => ({ ...(v as VariantWithDim), control: false }));

    return {
      personalized: false,
      variations: fallbackVariations,
    };
  }
};
```

### Registering the Plugin

#### For Akamai Edge Workers:

```typescript
const context = createAkamaiEdgeContext({
  request,
  manifest,
  options: {
    plugins: [
      {
        personalizationSelectionAlgorithms: {
          // Must match the key used in the mesh manifest
          "min-score-best-match": pickBestAboveMin,
        },
      },
    ],
  },
});
```

#### For Next.js Applications:

```typescript
export default function createUniformContext(
  serverContext?: NextPageContext
): Context {
  // 30 minutes
  const sessionExpirationInSeconds = 1800;
  const secondsInDay = 60 * 60 * 24;
  const expires = sessionExpirationInSeconds / secondsInDay;
  
  const plugins: ContextPlugin[] = [
    enableContextDevTools(),
    enableDebugConsoleLogDrain("debug"),
    {
      personalizationSelectionAlgorithms: {
        // Must match the key used in the mesh manifest
        "min-score-best-match": pickBestAboveMin,
      },
    },
  ];
  
  const context = new Context({
    defaultConsent: true,
    manifest: manifest as ManifestV2,
    transitionStore: new NextCookieTransitionDataStore({
      serverContext,
      cookieAttributes: {
        expires,
      },
    }),
    plugins: plugins,
    visitLifespan: sessionExpirationInSeconds * 1000,
    // Example: custom decay override
    decay: customDecay(),
  });
  
  return context;
}
```

### How the Algorithm Works

1. **Criteria Processing**: Reads the `minScore` and `dim` values configured through the integration UI
2. **Score Evaluation**: Compares visitor's dimension scores against the minimum thresholds
3. **Variant Selection**: Returns variants that meet or exceed the minimum score requirements
4. **Fallback Handling**: Uses default variants when personalization criteria aren't met
5. **Control Group Support**: Respects global control groups and consent requirements

## Usage Guide

### For Content Authors

1. **Create a Personalization Component** in your Uniform project
2. **Add Variants** to the personalization component
3. **Configure Criteria** for each variant:
   - Select a dimension from the grouped dropdown (Signal, Audience, Intent, Enrichment, or Quirk)
   - Set a minimum score threshold (e.g., 10, 50, 100)
4. **Publish** your content

### Example Use Cases

- **Premium Content**: Show premium features to users with high "premium-user" dimension scores (≥ 80)
- **Geographic Targeting**: Display location-specific content based on "user-location" scores (≥ 50)
- **Intent-Based Content**: Show product recommendations to users with high "purchase-intent" scores (≥ 70)
- **Device Optimization**: Serve mobile-optimized content to users with high "mobile-device" scores (≥ 90)

## Development

### Local Development

1. **Start the development server**:
   ```bash
   npm run dev
   ```
   The integration will be available at `http://localhost:9000`

2. **Test the integration** in the Uniform dashboard by configuring personalization criteria

### Project Structure

```
├── components/
│   ├── hooks/
│   │   └── useDimensionsAndQuirks.ts    # Custom hooks for data fetching
│   ├── utils/
│   │   └── dimensionUtils.ts            # Utility functions for grouping
│   └── MinScoreCriteriaEditor.tsx       # Main criteria editor component
├── pages/
│   ├── _app.tsx                         # App configuration with QueryClient
│   └── custom-ssc-min-score.tsx         # Integration page
├── mesh-manifest.json                   # Integration configuration
└── README.md                           # This file
```

## Reference Material

This project also contains reference material showing the full configurations and patterns possible with integrations. Refer to `mesh-manifest.reference.json` and `/pages/reference`, which provides a good starting point to copy from when implementing new locations.

To activate all reference locations in a 'reference integration', copy the contents of `mesh-manifest-reference.json` into an integration definition on your Uniform Team, under Settings -> Custom Integrations. This manifest file shows the full configuration possible in the integration manifest, and wires up the reference locations in `/pages/reference` to illustrate more advanced usage.

## Custom Edgehancers

Integration authors may write ESM JS code that is run to provide dynamic behaviour when fetching data resources defined by their integrations. Custom edgehancer code runs in a v8 sandbox at the edge and is highly performant.

> NOTE: custom edgehancers are only available to select customers, please contact Uniform if you are interested in using them

This project contains some example code for custom edgehancers in the `edgehancer` folder, which pairs with scripts to manage the deployment of the custom edgehancer in `package.json` (`deploy-edgehancer` and `remove-edgehancer`).

### Getting started with custom edgehancers

* Configure your .env file as outlined under `Manual installation via CLI` above. You will need a team admin level API key for this.
* Execute `npm run deploy-edgehancer`. This will:
  - Transpile and bundle the edgehancers from their TypeScript source (see `edgehancer/tsup.config.ts`)
  - Deploy the bundle to the `default` archetype of the `playground` data connector (as configured in `mesh-manifest.json` by default). This means that the custom code will run for any data resource that uses the target archetype.
  - There are two available hook points (the `deploy-edgehancer` script deploys an example of both): `preRequest` which may alter the HTTP request for a data resource but does not execute it (pre-caching), and `request` which replaces the default logic to make the fetch for a data resource and place it into cache. Much more detail is available in the source code for each example hook.

### Removing custom edgehancers

Run `npm run remove-edgehancer` to tear down the custom edgehancer if you would like to remove it from an archetype. The default edgehancer code will take over instead.

### Custom edgehancer tips and tricks

* **Limits:** Your custom edgehancers are allowed up to 100ms of CPU time to execute. This is purely CPU time, not wall time, and awaiting HTTP requests does not count against CPU time. Pre-request edgehancers may not make HTTP requests. Request edgehancers may make up to 2 * dataResourceBatchSizeProvided HTTP requests.
* **Breaking changes:** Deploying custom edgehancers that make breaking changes to API response formats where authors are already using those data types will result in breaking dynamic tokens in the authors' content. We strongly recommend a full unit test battery on your custom edgehancers to prevent this. Example unit tests are provided for the sample hooks.
* **Batching:** all hooks are provided with an array of all data resources of the registered archetype that need to be handled if more than one exists. For example a composition might reference 4 'singleEntry' data resources; in that case the hook receives an array of all 4. This can be used to facilitate batched requests (see `edgehancer/requestBatched.ts`). Note that response arrays must be in the same order as they were provided.
* **Testing:** The _test data type_ function on the Uniform dashboard is the fastest way to test a custom edgehancer at runtime.
* **Debugging:** Custom edgehancers do not capture console statements. For debugging, you can return warnings or errors to debug. If a hook throws an unhandled exception, that will be caught and added as an error to all affected data resources automatically.

