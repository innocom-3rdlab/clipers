import re
from typing import List, Dict, Optional

class UserAttributeAnalyzer:
    """
    YouTubeコメントからユーザー属性（年齢・地域・所属・性別など）を推定するクラス
    """
    def __init__(self):
        # 主要なパターンを定義
        self.age_patterns = [re.compile(r'(\d{2})歳'), re.compile(r'(\d{2})代'), re.compile(r'(高校生|大学生|中学生|小学生)')]
        self.region_patterns = [re.compile(r'(東京|大阪|北海道|沖縄|名古屋|福岡|京都|神奈川|埼玉|千葉|兵庫|広島|仙台|札幌|横浜)')]
        self.affiliation_patterns = [re.compile(r'(会社員|学生|主婦|フリーター|自営業|公務員|医師|看護師|エンジニア|教師|研究者)')]
        self.gender_patterns = [re.compile(r'(男性|女性|男|女|女子|男子)')]

    def analyze(self, comments: List[str]) -> Dict[str, Optional[str]]:
        ages, regions, affiliations, genders = [], [], [], []
        for comment in comments:
            for pat in self.age_patterns:
                m = pat.search(comment)
                if m:
                    ages.append(m.group(0))
            for pat in self.region_patterns:
                m = pat.search(comment)
                if m:
                    regions.append(m.group(0))
            for pat in self.affiliation_patterns:
                m = pat.search(comment)
                if m:
                    affiliations.append(m.group(0))
            for pat in self.gender_patterns:
                m = pat.search(comment)
                if m:
                    genders.append(m.group(0))
        def mode(arr):
            if not arr:
                return None
            freq = {}
            for a in arr:
                freq[a] = freq.get(a, 0) + 1
            return sorted(freq.items(), key=lambda x: x[1], reverse=True)[0][0]
        return {
            'age': mode(ages),
            'region': mode(regions),
            'affiliation': mode(affiliations),
            'gender': mode(genders)
        }

# テスト用
if __name__ == '__main__':
    comments = [
        '私は20代の会社員です。東京在住。',
        '高校生女子です！',
        '大阪の大学生です',
        '40歳の主婦です',
        '北海道から見てます',
        '男です。エンジニアやってます',
        '福岡の研究者です',
    ]
    analyzer = UserAttributeAnalyzer()
    print(analyzer.analyze(comments)) 