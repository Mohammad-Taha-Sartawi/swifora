import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:swifora/services/list_screen_navigation.dart';

/// A list screen whose items the test can remove.
class _FakeList extends StatefulWidget {
  const _FakeList({super.key, required this.initialCount});

  final int initialCount;

  @override
  State<_FakeList> createState() => _FakeListState();
}

class _FakeListState extends State<_FakeList> with ListScreenNavigation {
  late int count = widget.initialCount;

  @override
  String get listScreenTag => 'fake';

  void removeOne() => setState(() => count -= 1);

  @override
  Widget build(BuildContext context) {
    trackListItems(count);
    return Scaffold(body: Text('list $count'));
  }
}

class _Home extends StatelessWidget {
  const _Home();

  @override
  Widget build(BuildContext context) => const Scaffold(body: Text('home'));
}

final _navigatorKey = GlobalKey<NavigatorState>();
final _listKey = GlobalKey<_FakeListState>();

Future<void> _openList(WidgetTester tester, int count) async {
  await tester.pumpWidget(
    MaterialApp(navigatorKey: _navigatorKey, home: const _Home()),
  );
  _navigatorKey.currentState!.push(
    MaterialPageRoute(
      builder: (_) => _FakeList(key: _listKey, initialCount: count),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUp(VisibleListScreen.reset);

  testWidgets('removing the last item returns to the home screen', (
    tester,
  ) async {
    await _openList(tester, 2);

    _listKey.currentState!.removeOne();
    await tester.pumpAndSettle();
    expect(find.text('list 1'), findsOneWidget, reason: 'one item left: stay');

    _listKey.currentState!.removeOne();
    await tester.pumpAndSettle();
    expect(find.text('home'), findsOneWidget);
    expect(find.byType(_FakeList), findsNothing);
  });

  testWidgets('a screen opened empty stays open', (tester) async {
    await _openList(tester, 0);
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('list 0'), findsOneWidget);
  });

  testWidgets('emptied behind another screen, it leaves once back on top', (
    tester,
  ) async {
    await _openList(tester, 1);
    _navigatorKey.currentState!.push(
      MaterialPageRoute(builder: (_) => const Scaffold(body: Text('form'))),
    );
    await tester.pumpAndSettle();

    _listKey.currentState!.removeOne();
    await tester.pumpAndSettle();
    expect(find.text('form'), findsOneWidget, reason: 'never closes a form');

    _navigatorKey.currentState!.pop();
    await tester.pumpAndSettle();
    expect(find.text('home'), findsOneWidget);
    expect(find.byType(_FakeList), findsNothing);
  });

  testWidgets('reports the visible list screen only while it is on top', (
    tester,
  ) async {
    await _openList(tester, 1);
    expect(VisibleListScreen.tag, 'fake');

    _navigatorKey.currentState!.push(
      MaterialPageRoute(builder: (_) => const Scaffold(body: Text('form'))),
    );
    await tester.pumpAndSettle();
    expect(VisibleListScreen.tag, isNull);

    _navigatorKey.currentState!.pop();
    await tester.pumpAndSettle();
    expect(VisibleListScreen.tag, 'fake');

    _navigatorKey.currentState!.pop();
    await tester.pumpAndSettle();
    expect(VisibleListScreen.tag, isNull);
  });
}
