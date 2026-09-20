import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Grid } from '@astryxdesign/core/Grid';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { SelectableCard } from '@astryxdesign/core/SelectableCard';
import { PageHeader } from '../../../widgets/page-header';
import { modes, palettes, paletteColors, setAppearance, stonePreview, useAppearance, type Mode, type Palette } from '../../../shared/lib/appearance';
import { t, setLanguage, useLanguagePreference, type LanguagePreference, useLanguage } from '../../../shared/i18n';
import styles from './settings.module.css';

const modeLabels: () => Record<Mode, string> = () => ({ system: t('settings.mode.system'), light: t('settings.mode.light'), dark: t('settings.mode.dark') });
const paletteLabels: () => Record<Palette, [string, string]> = () => ({
  stone: [t('settings.palette.stone'), t('settings.palette.stoneHint')],
  sage: [t('settings.palette.sage'), t('settings.palette.sageHint')],
  olive: [t('settings.palette.olive'), t('settings.palette.oliveHint')],
  slate: [t('settings.palette.slate'), t('settings.palette.slateHint')],
  clay: [t('settings.palette.clay'), t('settings.palette.clayHint')],
});
// Each card previews the palette on both sides: page floor, surface, text and accent, light above dark.
const preview = (palette: Palette) => palette === 'stone' ? stonePreview : paletteColors[palette];
const sides = [0, 1] as const;

export function SettingsPage() {
  useLanguage();
  const { mode, palette } = useAppearance();
  const language = useLanguagePreference();
  return (
    <VStack gap={0} className={styles.page}>
      <PageHeader trail={[{ label: t('settings.title') }]} />
      <VStack gap={0} className={styles.column}>
        <VStack gap={1} className={styles.pageTitle}>
          <Heading level={1}>{t('settings.title')}</Heading>
          <Text type="supporting" color="secondary">{t('settings.subtitle')}</Text>
        </VStack>
        <VStack gap={0} className={styles.sections}>
          <VStack as="section" gap={3} className={styles.section} aria-label={t('settings.language')}>
            <VStack gap={1}><Heading level={2}>{t('settings.language')}</Heading></VStack>
            <HStack gap={0}>
              <SegmentedControl label={t('settings.language')} value={language} onChange={value => setLanguage(value as LanguagePreference)}>
                <SegmentedControlItem value="system" label={t('settings.language.system')} />
                <SegmentedControlItem value="en" label="English" />
                <SegmentedControlItem value="ko" label="한국어" />
              </SegmentedControl>
            </HStack>
          </VStack>
          <VStack as="section" gap={3} className={styles.section} aria-label={t('settings.mode')}>
            <VStack gap={1}><Heading level={2}>{t('settings.mode')}</Heading><Text type="supporting" color="secondary">{t('settings.modeHint')}</Text></VStack>
            <HStack gap={0}>
              <SegmentedControl label={t('settings.mode')} value={mode} onChange={value => setAppearance({ mode: value as Mode })}>
                {modes.map(value => <SegmentedControlItem key={value} value={value} label={modeLabels()[value]} />)}
              </SegmentedControl>
            </HStack>
          </VStack>
          <VStack as="section" gap={3} className={styles.section} aria-label={t('settings.palette')}>
            <VStack gap={1}><Heading level={2}>{t('settings.palette')}</Heading><Text type="supporting" color="secondary">{t('settings.paletteHint')}</Text></VStack>
            <Grid columns={{ minWidth: 176, repeat: 'fit', max: 5 }} gap={3}>
              {palettes.map(value => { const colors = preview(value); const [label, hint] = paletteLabels()[value]; return (
                // A palette cannot be switched off, only replaced, so deselecting the current card is ignored.
                <SelectableCard key={value} label={label} isSelected={palette === value} onChange={selected => { if (selected) setAppearance({ palette: value }); }}>
                  <VStack gap={3}>
                    <VStack gap={0} className={styles.swatches} aria-hidden="true">
                      {sides.map(side => <HStack key={side} gap={2} vAlign="center" className={styles.sample} style={{ background: colors.body[side] }}>
                        <HStack gap={2} vAlign="center" className={styles.sampleSurface} style={{ background: colors.surface[side], color: colors.text[side] }}>
                          <VStack gap={0} className={styles.sampleDot} style={{ background: colors.accent[side] }} />
                          <VStack gap={0} className={styles.sampleLine} style={{ background: colors.text[side] }} />
                        </HStack>
                      </HStack>)}
                    </VStack>
                    <VStack gap={1}><Text type="label">{label}</Text><Text type="supporting" color="secondary">{hint}</Text></VStack>
                  </VStack>
                </SelectableCard>
              ); })}
            </Grid>
          </VStack>
        </VStack>
      </VStack>
    </VStack>
  );
}
