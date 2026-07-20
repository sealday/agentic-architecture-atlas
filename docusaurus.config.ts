import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const repositoryUrl = 'https://github.com/sealday/agentic-architecture-atlas';

const config: Config = {
  title: 'Agentic Architecture Atlas',
  tagline: '从真实项目中学习 AI 智能体如何协作',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://sealday.github.io',
  baseUrl: '/agentic-architecture-atlas/',
  organizationName: 'sealday',
  projectName: 'agentic-architecture-atlas',
  trailingSlash: false,
  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans'],
  },

  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'content',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Agentic Architecture Atlas',
      items: [
        {to: '/', label: '首页', position: 'left'},
        {to: '/cases', label: '案例库', position: 'left'},
        {to: '/patterns', label: '架构模式', position: 'left'},
        {to: '/questions', label: '设计题', position: 'left'},
        {to: '/paths', label: '学习路径', position: 'left'},
        {to: '/references', label: '资料库', position: 'left'},
        {href: repositoryUrl, label: 'GitHub', position: 'right'},
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: '内容',
          items: [
            {label: '首页', to: '/'},
            {label: '案例库', to: '/cases'},
            {label: '架构模式', to: '/patterns'},
          ],
        },
        {
          title: '学习',
          items: [
            {label: '设计题', to: '/questions'},
            {label: '学习路径', to: '/paths'},
            {label: '资料库', to: '/references'},
          ],
        },
        {
          title: '项目',
          items: [{label: 'GitHub', href: repositoryUrl}],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Agentic Architecture Atlas. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
